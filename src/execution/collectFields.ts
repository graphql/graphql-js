import { AccumulatorMap } from '../jsutils/AccumulatorMap.js';
import type { ObjMap, ReadOnlyObjMap } from '../jsutils/ObjMap.js';

import type {
  ConstValueNode,
  DirectiveNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  SelectionSetNode,
} from '../language/ast.js';
import { Kind } from '../language/kinds.js';

import type { GraphQLObjectType } from '../type/definition.js';
import { isAbstractType } from '../type/definition.js';
import {
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
} from '../type/directives.js';
import type { GraphQLSchema } from '../type/schema.js';

import { typeFromAST } from '../utilities/typeFromAST.js';

import type { GraphQLVariableSignature } from './getVariableSignature.js';
import type { VariableValues } from './values.js';
import { getArgumentValues, getFragmentVariableValues } from './values.js';

export interface FragmentVariableValues {
  readonly sources: ReadOnlyObjMap<FragmentVariableValueSource>;
  readonly coerced: ReadOnlyObjMap<unknown>;
}

interface FragmentVariableValueSource {
  readonly signature: GraphQLVariableSignature;
  readonly value?: ConstValueNode;
  readonly fragmentVariableValues?: FragmentVariableValues;
}

export interface FieldDetails {
  node: FieldNode;
  fragmentVariableValues?: FragmentVariableValues | undefined;
}

export type FieldDetailsList = ReadonlyArray<FieldDetails>;

export type GroupedFieldSet = ReadonlyMap<string, FieldDetailsList>;

export interface FragmentDetails {
  definition: FragmentDefinitionNode;
  variableSignatures?: ObjMap<GraphQLVariableSignature> | undefined;
}

interface CollectFieldsContext {
  schema: GraphQLSchema;
  fragments: ObjMap<FragmentDetails>;
  variableValues: VariableValues;
  runtimeType: GraphQLObjectType;
  visitedFragmentNames: Set<string>;
  hideSuggestions: boolean;
  forbiddenDirectiveInstances: Array<DirectiveNode>;
  forbidSkipAndInclude: boolean;
}

/**
 * Given a selectionSet, collects all of the fields and returns them.
 *
 * CollectFields requires the "runtime type" of an object. For a field that
 * returns an Interface or Union type, the "runtime type" will be the actual
 * object type returned by that field.
 *
 * @internal
 */
// eslint-disable-next-line max-params
export function collectFields(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDetails>,
  variableValues: VariableValues,
  runtimeType: GraphQLObjectType,
  selectionSet: SelectionSetNode,
  hideSuggestions: boolean,
  forbidSkipAndInclude = false,
): {
  groupedFieldSet: GroupedFieldSet;
  forbiddenDirectiveInstances: ReadonlyArray<DirectiveNode>;
} {
  const groupedFieldSet = new AccumulatorMap<string, FieldDetails>();
  const context: CollectFieldsContext = {
    schema,
    fragments,
    variableValues,
    runtimeType,
    visitedFragmentNames: new Set(),
    hideSuggestions,
    forbiddenDirectiveInstances: [],
    forbidSkipAndInclude,
  };

  collectFieldsImpl(context, selectionSet, groupedFieldSet);
  return {
    groupedFieldSet,
    forbiddenDirectiveInstances: context.forbiddenDirectiveInstances,
  };
}

/**
 * Given an array of field nodes, collects all of the subfields of the passed
 * in fields, and returns them at the end.
 *
 * CollectSubFields requires the "return type" of an object. For a field that
 * returns an Interface or Union type, the "return type" will be the actual
 * object type returned by that field.
 *
 * @internal
 */
// eslint-disable-next-line max-params
export function collectSubfields(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDetails>,
  variableValues: VariableValues,
  returnType: GraphQLObjectType,
  fieldDetailsList: FieldDetailsList,
  hideSuggestions: boolean,
): GroupedFieldSet {
  const context: CollectFieldsContext = {
    schema,
    fragments,
    variableValues,
    runtimeType: returnType,
    visitedFragmentNames: new Set(),
    hideSuggestions,
    forbiddenDirectiveInstances: [],
    forbidSkipAndInclude: false,
  };
  const subGroupedFieldSet = new AccumulatorMap<string, FieldDetails>();

  for (const fieldDetail of fieldDetailsList) {
    const selectionSet = fieldDetail.node.selectionSet;
    if (selectionSet) {
      const { fragmentVariableValues } = fieldDetail;
      collectFieldsImpl(
        context,
        selectionSet,
        subGroupedFieldSet,
        fragmentVariableValues,
      );
    }
  }

  return subGroupedFieldSet;
}

function collectFieldsImpl(
  context: CollectFieldsContext,
  selectionSet: SelectionSetNode,
  groupedFieldSet: AccumulatorMap<string, FieldDetails>,
  fragmentVariableValues?: FragmentVariableValues,
): void {
  const {
    schema,
    fragments,
    variableValues,
    runtimeType,
    visitedFragmentNames,
    hideSuggestions,
  } = context;

  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        if (
          !shouldIncludeNode(
            context,
            selection,
            variableValues,
            fragmentVariableValues,
          )
        ) {
          continue;
        }
        groupedFieldSet.add(getFieldEntryKey(selection), {
          node: selection,
          fragmentVariableValues,
        });
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        if (
          !shouldIncludeNode(
            context,
            selection,
            variableValues,
            fragmentVariableValues,
          ) ||
          !doesFragmentConditionMatch(schema, selection, runtimeType)
        ) {
          continue;
        }

        collectFieldsImpl(
          context,
          selection.selectionSet,
          groupedFieldSet,
          fragmentVariableValues,
        );

        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragName = selection.name.value;

        if (
          visitedFragmentNames.has(fragName) ||
          !shouldIncludeNode(
            context,
            selection,
            variableValues,
            fragmentVariableValues,
          )
        ) {
          continue;
        }

        const fragment = fragments[fragName];
        if (
          fragment == null ||
          !doesFragmentConditionMatch(schema, fragment.definition, runtimeType)
        ) {
          continue;
        }

        const fragmentVariableSignatures = fragment.variableSignatures;
        let newFragmentVariableValues: FragmentVariableValues | undefined;
        if (fragmentVariableSignatures) {
          newFragmentVariableValues = getFragmentVariableValues(
            selection,
            fragmentVariableSignatures,
            variableValues,
            fragmentVariableValues,
            hideSuggestions,
          );
        }

        visitedFragmentNames.add(fragName);
        collectFieldsImpl(
          context,
          fragment.definition.selectionSet,
          groupedFieldSet,
          newFragmentVariableValues,
        );
        break;
      }
    }
  }
}

/**
 * Determines if a field should be included based on the `@include` and `@skip`
 * directives, where `@skip` has higher precedence than `@include`.
 */
function shouldIncludeNode(
  context: CollectFieldsContext,
  node: FragmentSpreadNode | FieldNode | InlineFragmentNode,
  variableValues: VariableValues,
  fragmentVariableValues: FragmentVariableValues | undefined,
): boolean {
  const skipDirectiveNode = node.directives?.find(
    (directive) => directive.name.value === GraphQLSkipDirective.name,
  );
  if (skipDirectiveNode && context.forbidSkipAndInclude) {
    context.forbiddenDirectiveInstances.push(skipDirectiveNode);
    return false;
  }
  const skip = skipDirectiveNode
    ? getArgumentValues(
        GraphQLSkipDirective,
        skipDirectiveNode,
        variableValues,
        fragmentVariableValues,
        context.hideSuggestions,
      )
    : undefined;
  if (skip?.if === true) {
    return false;
  }

  const includeDirectiveNode = node.directives?.find(
    (directive) => directive.name.value === GraphQLIncludeDirective.name,
  );
  if (includeDirectiveNode && context.forbidSkipAndInclude) {
    context.forbiddenDirectiveInstances.push(includeDirectiveNode);
    return false;
  }
  const include = includeDirectiveNode
    ? getArgumentValues(
        GraphQLIncludeDirective,
        includeDirectiveNode,
        variableValues,
        fragmentVariableValues,
        context.hideSuggestions,
      )
    : undefined;
  if (include?.if === false) {
    return false;
  }
  return true;
}

/**
 * Determines if a fragment is applicable to the given type.
 */
function doesFragmentConditionMatch(
  schema: GraphQLSchema,
  fragment: FragmentDefinitionNode | InlineFragmentNode,
  type: GraphQLObjectType,
): boolean {
  const typeConditionNode = fragment.typeCondition;
  if (!typeConditionNode) {
    return true;
  }
  const conditionalType = typeFromAST(schema, typeConditionNode);
  if (conditionalType === type) {
    return true;
  }
  if (isAbstractType(conditionalType)) {
    return schema.isSubType(conditionalType, type);
  }
  return false;
}

/**
 * Implements the logic to compute the key of a given field's entry
 */
function getFieldEntryKey(node: FieldNode): string {
  return node.alias ? node.alias.value : node.name.value;
}
