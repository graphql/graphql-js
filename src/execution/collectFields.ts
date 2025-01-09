import { AccumulatorMap } from '../jsutils/AccumulatorMap.js';
import type { ObjMap } from '../jsutils/ObjMap.js';

import type {
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
  GraphQLDeferDirective,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
} from '../type/directives.js';
import type { GraphQLSchema } from '../type/schema.js';

import { typeFromAST } from '../utilities/typeFromAST.js';

import type { GraphQLVariableSignature } from './getVariableSignature.js';
import type { VariableValues } from './values.js';
import { getDirectiveValues, getFragmentVariableValues } from './values.js';

export interface DeferUsage {
  label: string | undefined;
  parentDeferUsage: DeferUsage | undefined;
}

export interface FieldDetails {
  node: FieldNode;
  deferUsage?: DeferUsage | undefined;
  fragmentVariableValues?: VariableValues | undefined;
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
// eslint-disable-next-line @typescript-eslint/max-params
export function collectFields(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDetails>,
  variableValues: VariableValues,
  runtimeType: GraphQLObjectType,
  selectionSet: SelectionSetNode,
  hideSuggestions: boolean,
): {
  groupedFieldSet: GroupedFieldSet;
  newDeferUsages: ReadonlyArray<DeferUsage>;
} {
  const groupedFieldSet = new AccumulatorMap<string, FieldDetails>();
  const newDeferUsages: Array<DeferUsage> = [];
  const context: CollectFieldsContext = {
    schema,
    fragments,
    variableValues,
    runtimeType,
    visitedFragmentNames: new Set(),
    hideSuggestions,
  };

  collectFieldsImpl(context, selectionSet, groupedFieldSet, newDeferUsages);
  return { groupedFieldSet, newDeferUsages };
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
// eslint-disable-next-line @typescript-eslint/max-params
export function collectSubfields(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDetails>,
  variableValues: VariableValues,
  returnType: GraphQLObjectType,
  fieldDetailsList: FieldDetailsList,
  hideSuggestions: boolean,
): {
  groupedFieldSet: GroupedFieldSet;
  newDeferUsages: ReadonlyArray<DeferUsage>;
} {
  const context: CollectFieldsContext = {
    schema,
    fragments,
    variableValues,
    runtimeType: returnType,
    visitedFragmentNames: new Set(),
    hideSuggestions,
  };
  const subGroupedFieldSet = new AccumulatorMap<string, FieldDetails>();
  const newDeferUsages: Array<DeferUsage> = [];

  for (const fieldDetail of fieldDetailsList) {
    const selectionSet = fieldDetail.node.selectionSet;
    if (selectionSet) {
      const { deferUsage, fragmentVariableValues } = fieldDetail;
      collectFieldsImpl(
        context,
        selectionSet,
        subGroupedFieldSet,
        newDeferUsages,
        deferUsage,
        fragmentVariableValues,
      );
    }
  }

  return {
    groupedFieldSet: subGroupedFieldSet,
    newDeferUsages,
  };
}

// eslint-disable-next-line @typescript-eslint/max-params
function collectFieldsImpl(
  context: CollectFieldsContext,
  selectionSet: SelectionSetNode,
  groupedFieldSet: AccumulatorMap<string, FieldDetails>,
  newDeferUsages: Array<DeferUsage>,
  deferUsage?: DeferUsage,
  fragmentVariableValues?: VariableValues,
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
          !shouldIncludeNode(selection, variableValues, fragmentVariableValues)
        ) {
          continue;
        }
        groupedFieldSet.add(getFieldEntryKey(selection), {
          node: selection,
          deferUsage,
          fragmentVariableValues,
        });
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        if (
          !shouldIncludeNode(
            selection,
            variableValues,
            fragmentVariableValues,
          ) ||
          !doesFragmentConditionMatch(schema, selection, runtimeType)
        ) {
          continue;
        }

        const newDeferUsage = getDeferUsage(
          variableValues,
          fragmentVariableValues,
          selection,
          deferUsage,
        );

        if (!newDeferUsage) {
          collectFieldsImpl(
            context,
            selection.selectionSet,
            groupedFieldSet,
            newDeferUsages,
            deferUsage,
            fragmentVariableValues,
          );
        } else {
          newDeferUsages.push(newDeferUsage);
          collectFieldsImpl(
            context,
            selection.selectionSet,
            groupedFieldSet,
            newDeferUsages,
            newDeferUsage,
            fragmentVariableValues,
          );
        }

        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragName = selection.name.value;

        if (
          visitedFragmentNames.has(fragName) ||
          !shouldIncludeNode(selection, variableValues, fragmentVariableValues)
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

        const newDeferUsage = getDeferUsage(
          variableValues,
          fragmentVariableValues,
          selection,
          deferUsage,
        );

        const fragmentVariableSignatures = fragment.variableSignatures;
        let newFragmentVariableValues: VariableValues | undefined;
        if (fragmentVariableSignatures) {
          newFragmentVariableValues = getFragmentVariableValues(
            selection,
            fragmentVariableSignatures,
            variableValues,
            fragmentVariableValues,
            hideSuggestions,
          );
        }

        if (!newDeferUsage) {
          visitedFragmentNames.add(fragName);
          collectFieldsImpl(
            context,
            fragment.definition.selectionSet,
            groupedFieldSet,
            newDeferUsages,
            deferUsage,
            newFragmentVariableValues,
          );
        } else {
          newDeferUsages.push(newDeferUsage);
          collectFieldsImpl(
            context,
            fragment.definition.selectionSet,
            groupedFieldSet,
            newDeferUsages,
            newDeferUsage,
            newFragmentVariableValues,
          );
        }
        break;
      }
    }
  }
}

/**
 * Returns an object containing the `@defer` arguments if a field should be
 * deferred based on the experimental flag, defer directive present and
 * not disabled by the "if" argument.
 */
function getDeferUsage(
  variableValues: VariableValues,
  fragmentVariableValues: VariableValues | undefined,
  node: FragmentSpreadNode | InlineFragmentNode,
  parentDeferUsage: DeferUsage | undefined,
): DeferUsage | undefined {
  const defer = getDirectiveValues(
    GraphQLDeferDirective,
    node,
    variableValues,
    fragmentVariableValues,
  );

  if (!defer) {
    return;
  }

  if (defer.if === false) {
    return;
  }

  return {
    label: typeof defer.label === 'string' ? defer.label : undefined,
    parentDeferUsage,
  };
}

/**
 * Determines if a field should be included based on the `@include` and `@skip`
 * directives, where `@skip` has higher precedence than `@include`.
 */
function shouldIncludeNode(
  node: FragmentSpreadNode | FieldNode | InlineFragmentNode,
  variableValues: VariableValues,
  fragmentVariableValues: VariableValues | undefined,
): boolean {
  const skip = getDirectiveValues(
    GraphQLSkipDirective,
    node,
    variableValues,
    fragmentVariableValues,
  );
  if (skip?.if === true) {
    return false;
  }

  const include = getDirectiveValues(
    GraphQLIncludeDirective,
    node,
    variableValues,
    fragmentVariableValues,
  );
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
