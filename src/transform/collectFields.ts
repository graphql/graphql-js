import { AccumulatorMap } from '../jsutils/AccumulatorMap.js';
import { invariant } from '../jsutils/invariant.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path } from '../jsutils/Path.js';
import { pathToArray } from '../jsutils/Path.js';

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

import type { GraphQLVariableSignature } from '../execution/getVariableSignature.js';
import type { VariableValues } from '../execution/values.js';
import {
  getDirectiveValues,
  getFragmentVariableValues,
} from '../execution/values.js';

import { typeFromAST } from '../utilities/typeFromAST.js';

import type { TransformationContext } from './buildTransformationContext.js';

export interface FieldDetails {
  node: FieldNode;
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
  pendingLabelsByPath: Map<string, Set<string>>;
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

export function collectFields(
  transformationContext: TransformationContext,
  runtimeType: GraphQLObjectType,
  selectionSet: SelectionSetNode,
  path: Path | undefined,
): GroupedFieldSet {
  const {
    transformedArgs: { schema, fragments, variableValues, hideSuggestions },
    pendingLabelsByPath,
  } = transformationContext;
  const groupedFieldSet = new AccumulatorMap<string, FieldDetails>();
  const context: CollectFieldsContext = {
    schema,
    fragments,
    variableValues,
    runtimeType,
    visitedFragmentNames: new Set(),
    pendingLabelsByPath,
    hideSuggestions,
  };

  collectFieldsImpl(context, selectionSet, groupedFieldSet, path);
  return groupedFieldSet;
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
export function collectSubfields(
  transformationContext: TransformationContext,
  returnType: GraphQLObjectType,
  fieldDetailsList: FieldDetailsList,
  path: Path | undefined,
): GroupedFieldSet {
  const {
    transformedArgs: { schema, fragments, variableValues, hideSuggestions },
    pendingLabelsByPath,
  } = transformationContext;
  const context: CollectFieldsContext = {
    schema,
    fragments,
    variableValues,
    runtimeType: returnType,
    visitedFragmentNames: new Set(),
    pendingLabelsByPath,
    hideSuggestions,
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
        path,
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
  path?: Path | undefined,
  fragmentVariableValues?: VariableValues,
): void {
  const {
    schema,
    fragments,
    variableValues,
    runtimeType,
    visitedFragmentNames,
    pendingLabelsByPath,
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
          fragmentVariableValues,
        });
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        if (
          isDeferred(selection, path, pendingLabelsByPath) ||
          !shouldIncludeNode(
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
          path,
          fragmentVariableValues,
        );

        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragName = selection.name.value;

        if (
          visitedFragmentNames.has(fragName) ||
          isDeferred(selection, path, pendingLabelsByPath) ||
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

        visitedFragmentNames.add(fragName);
        collectFieldsImpl(
          context,
          fragment.definition.selectionSet,
          groupedFieldSet,
          path,
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

/**
 * Implements the logic to check if a fragment annotated with the `@defer`
 * directive has been actually deferred or inlined.
 */
function isDeferred(
  selection: FragmentSpreadNode | InlineFragmentNode,
  path: Path | undefined,
  pendingLabelsByPath: Map<string, Set<string>>,
): boolean {
  const deferDirective = selection.directives?.find(
    (directive) => directive.name.value === GraphQLDeferDirective.name,
  );
  if (!deferDirective) {
    return false;
  }
  const pathStr = pathToArray(path).join('.');
  const labels = pendingLabelsByPath.get(pathStr);
  if (labels == null) {
    return false;
  }
  const labelArg = deferDirective.arguments?.find(
    (arg) => arg.name.value === 'label',
  );
  invariant(labelArg != null);
  const labelValue = labelArg.value;
  invariant(labelValue.kind === Kind.STRING);
  const label = labelValue.value;
  return labels.has(label);
}
