import { AccumulatorMap } from '../jsutils/AccumulatorMap.js';
import { invariant } from '../jsutils/invariant.js';
import type { ObjMap } from '../jsutils/ObjMap.js';

import type {
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  OperationDefinitionNode,
  SelectionSetNode,
} from '../language/ast.js';
import { OperationTypeNode } from '../language/ast.js';
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

import { getDirectiveValues } from './values.js';

export type FieldGroup = ReadonlyArray<TaggedFieldNode>;

export type GroupedFieldSet = Map<string, FieldGroup>;

/**
 * A tagged field node includes metadata necessary to determine whether a field should
 * be executed.
 *
 * A field's depth is equivalent to the number of fields between the given field and
 * the operation root. For example, root fields have a depth of 0, their sub-fields
 * have a depth of 1, and so on. Tagging fields with their depth is necessary only to
 * compute a field's "defer depth".
 *
 * A field's defer depth is the depth of the closest containing defer directive , or
 * undefined, if the field is not contained by a deferred fragment.
 *
 * Because deferred fragments at a given level are merged, the defer depth may be used
 * as a unique id to tag the fields for inclusion within a given deferred payload.
 */
export interface TaggedFieldNode {
  fieldNode: FieldNode;
  depth: number;
  deferDepth: number | undefined;
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
  variableValues: { [variable: string]: unknown },
  runtimeType: GraphQLObjectType,
  operation: OperationDefinitionNode,
): {
  groupedFieldSet: GroupedFieldSet;
  newDeferDepth: number | undefined;
} {
  const groupedFieldSet = new AccumulatorMap<string, TaggedFieldNode>();
  const newDeferDepth = collectFieldsImpl(
    schema,
    fragments,
    variableValues,
    operation,
    runtimeType,
    operation.selectionSet,
    groupedFieldSet,
    new Set(),
    0,
    undefined,
  );
  return {
    groupedFieldSet,
    newDeferDepth,
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
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: { [variable: string]: unknown },
  operation: OperationDefinitionNode,
  returnType: GraphQLObjectType,
  fieldGroup: FieldGroup,
): {
  groupedFieldSet: GroupedFieldSet;
  newDeferDepth: number | undefined;
} {
  const groupedFieldSet = new AccumulatorMap<string, TaggedFieldNode>();
  let newDeferDepth: number | undefined;
  const visitedFragmentNames = new Set<string>();

  for (const field of fieldGroup) {
    if (field.fieldNode.selectionSet) {
      const nestedNewDeferDepth = collectFieldsImpl(
        schema,
        fragments,
        variableValues,
        operation,
        returnType,
        field.fieldNode.selectionSet,
        groupedFieldSet,
        visitedFragmentNames,
        fieldGroup[0].depth + 1,
        field.deferDepth,
      );
      if (nestedNewDeferDepth !== undefined) {
        newDeferDepth = nestedNewDeferDepth;
      }
    }
  }

  return {
    groupedFieldSet,
    newDeferDepth,
  };
}

// eslint-disable-next-line max-params
function collectFieldsImpl(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: { [variable: string]: unknown },
  operation: OperationDefinitionNode,
  runtimeType: GraphQLObjectType,
  selectionSet: SelectionSetNode,
  groupedFieldSet: AccumulatorMap<string, TaggedFieldNode>,
  visitedFragmentNames: Set<string>,
  depth: number,
  deferDepth: number | undefined,
): number | undefined {
  let hasNewDefer = false;
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        if (!shouldIncludeNode(variableValues, selection)) {
          continue;
        }
        groupedFieldSet.add(getFieldEntryKey(selection), {
          fieldNode: selection,
          depth,
          deferDepth,
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

        const defer = isFragmentDeferred(operation, variableValues, selection);

        const nestedHasNewDefer = collectFieldsImpl(
          schema,
          fragments,
          variableValues,
          operation,
          runtimeType,
          selection.selectionSet,
          groupedFieldSet,
          visitedFragmentNames,
          depth,
          defer ? depth : deferDepth,
        );

        hasNewDefer ||= defer || nestedHasNewDefer !== undefined;

        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragName = selection.name.value;

        if (!shouldIncludeNode(variableValues, selection)) {
          continue;
        }

        const defer = isFragmentDeferred(operation, variableValues, selection);
        if (visitedFragmentNames.has(fragName) && !defer) {
          continue;
        }

        const fragment = fragments[fragName];
        if (
          !fragment ||
          !doesFragmentConditionMatch(schema, fragment, runtimeType)
        ) {
          continue;
        }

        if (!defer) {
          visitedFragmentNames.add(fragName);
        }

        const nestedNewDeferDepth = collectFieldsImpl(
          schema,
          fragments,
          variableValues,
          operation,
          runtimeType,
          fragment.selectionSet,
          groupedFieldSet,
          visitedFragmentNames,
          depth,
          defer ? depth : deferDepth,
        );

        hasNewDefer ||= defer || nestedNewDeferDepth !== undefined;

        break;
      }
    }
  }
  return hasNewDefer ? depth : undefined;
}

/**
 * Returns whether a fragment should be deferred based on the presence of a
 * defer directive and whether it is disabled by the "if" argument.
 */
function isFragmentDeferred(
  operation: OperationDefinitionNode,
  variableValues: { [variable: string]: unknown },
  node: FragmentSpreadNode | InlineFragmentNode,
): boolean {
  const defer = getDirectiveValues(GraphQLDeferDirective, node, variableValues);

  if (!defer) {
    return false;
  }

  if (defer.if === false) {
    return false;
  }

  invariant(
    operation.operation !== OperationTypeNode.SUBSCRIPTION,
    '`@defer` directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
  );

  return true;
}

/**
 * Determines if a field should be included based on the `@include` and `@skip`
 * directives, where `@skip` has higher precedence than `@include`.
 */
function shouldIncludeNode(
  variableValues: { [variable: string]: unknown },
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
