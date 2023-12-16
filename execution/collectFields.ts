import { AccumulatorMap } from '../jsutils/AccumulatorMap.ts';
import { invariant } from '../jsutils/invariant.ts';
import type { ObjMap } from '../jsutils/ObjMap.ts';
import type {
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  OperationDefinitionNode,
  SelectionSetNode,
} from '../language/ast.ts';
import { OperationTypeNode } from '../language/ast.ts';
import { Kind } from '../language/kinds.ts';
import type { GraphQLObjectType } from '../type/definition.ts';
import { isAbstractType } from '../type/definition.ts';
import {
  GraphQLDeferDirective,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
} from '../type/directives.ts';
import type { GraphQLSchema } from '../type/schema.ts';
import { typeFromAST } from '../utilities/typeFromAST.ts';
import { getDirectiveValues } from './values.ts';
export interface DeferUsage {
  label: string | undefined;
  parentDeferUsage: DeferUsage | undefined;
}
export interface FieldDetails {
  node: FieldNode;
  deferUsage: DeferUsage | undefined;
}
interface CollectFieldsContext {
  schema: GraphQLSchema;
  fragments: ObjMap<FragmentDefinitionNode>;
  variableValues: {
    [variable: string]: unknown;
  };
  operation: OperationDefinitionNode;
  runtimeType: GraphQLObjectType;
  visitedFragmentNames: Set<string>;
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
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: {
    [variable: string]: unknown;
  },
  runtimeType: GraphQLObjectType,
  operation: OperationDefinitionNode,
): Map<string, ReadonlyArray<FieldDetails>> {
  const groupedFieldSet = new AccumulatorMap<string, FieldDetails>();
  const context: CollectFieldsContext = {
    schema,
    fragments,
    variableValues,
    runtimeType,
    operation,
    visitedFragmentNames: new Set(),
  };
  collectFieldsImpl(context, operation.selectionSet, groupedFieldSet);
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
// eslint-disable-next-line max-params
export function collectSubfields(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: {
    [variable: string]: unknown;
  },
  operation: OperationDefinitionNode,
  returnType: GraphQLObjectType,
  fieldDetails: ReadonlyArray<FieldDetails>,
): Map<string, ReadonlyArray<FieldDetails>> {
  const context: CollectFieldsContext = {
    schema,
    fragments,
    variableValues,
    runtimeType: returnType,
    operation,
    visitedFragmentNames: new Set(),
  };
  const subGroupedFieldSet = new AccumulatorMap<string, FieldDetails>();
  for (const fieldDetail of fieldDetails) {
    const node = fieldDetail.node;
    if (node.selectionSet) {
      collectFieldsImpl(
        context,
        node.selectionSet,
        subGroupedFieldSet,
        fieldDetail.deferUsage,
      );
    }
  }
  return subGroupedFieldSet;
}
function collectFieldsImpl(
  context: CollectFieldsContext,
  selectionSet: SelectionSetNode,
  groupedFieldSet: AccumulatorMap<string, FieldDetails>,
  parentDeferUsage?: DeferUsage,
  deferUsage?: DeferUsage,
): void {
  const {
    schema,
    fragments,
    variableValues,
    runtimeType,
    operation,
    visitedFragmentNames,
  } = context;
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        if (!shouldIncludeNode(variableValues, selection)) {
          continue;
        }
        groupedFieldSet.add(getFieldEntryKey(selection), {
          node: selection,
          deferUsage: deferUsage ?? parentDeferUsage,
        });
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        if (
          !shouldIncludeNode(variableValues, selection) ||
          !doesFragmentConditionMatch(schema, selection, runtimeType)
        ) {
          continue;
        }
        const newDeferUsage = getDeferUsage(
          operation,
          variableValues,
          selection,
          parentDeferUsage,
        );
        collectFieldsImpl(
          context,
          selection.selectionSet,
          groupedFieldSet,
          parentDeferUsage,
          newDeferUsage ?? deferUsage,
        );
        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragName = selection.name.value;
        const newDeferUsage = getDeferUsage(
          operation,
          variableValues,
          selection,
          parentDeferUsage,
        );
        if (
          !newDeferUsage &&
          (visitedFragmentNames.has(fragName) ||
            !shouldIncludeNode(variableValues, selection))
        ) {
          continue;
        }
        const fragment = fragments[fragName];
        if (
          fragment == null ||
          !doesFragmentConditionMatch(schema, fragment, runtimeType)
        ) {
          continue;
        }
        if (!newDeferUsage) {
          visitedFragmentNames.add(fragName);
        }
        collectFieldsImpl(
          context,
          fragment.selectionSet,
          groupedFieldSet,
          parentDeferUsage,
          newDeferUsage ?? deferUsage,
        );
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
  operation: OperationDefinitionNode,
  variableValues: {
    [variable: string]: unknown;
  },
  node: FragmentSpreadNode | InlineFragmentNode,
  parentDeferUsage: DeferUsage | undefined,
): DeferUsage | undefined {
  const defer = getDirectiveValues(GraphQLDeferDirective, node, variableValues);
  if (!defer) {
    return;
  }
  if (defer.if === false) {
    return;
  }
  operation.operation !== OperationTypeNode.SUBSCRIPTION ||
    invariant(
      false,
      '`@defer` directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
    );
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
  variableValues: {
    [variable: string]: unknown;
  },
  node: FragmentSpreadNode | FieldNode | InlineFragmentNode,
): boolean {
  const skip = getDirectiveValues(GraphQLSkipDirective, node, variableValues);
  if (skip?.if === true) {
    return false;
  }
  const include = getDirectiveValues(
    GraphQLIncludeDirective,
    node,
    variableValues,
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
