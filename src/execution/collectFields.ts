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

export interface DeferUsage {
  label: string | undefined;
}

export interface FieldGroup {
  parentType: GraphQLObjectType;
  fieldName: string;
  fields: Map<DeferUsage | undefined, ReadonlyArray<FieldNode>>;
  inInitialResult: boolean;
  shouldInitiateDefer: boolean;
}
interface MutableFieldGroup extends FieldGroup {
  fields: AccumulatorMap<DeferUsage | undefined, FieldNode>;
}

export type GroupedFieldSet = Map<string, FieldGroup>;

type MutableGroupedFieldSet = Map<string, MutableFieldGroup>;

export interface CollectFieldsResult {
  groupedFieldSet: GroupedFieldSet;
  deferUsages: Map<string | undefined, DeferUsage>;
}

interface MutableCollectFieldsResult {
  groupedFieldSet: MutableGroupedFieldSet;
  deferUsages: Map<string | undefined, DeferUsage>;
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
): CollectFieldsResult {
  const groupedFieldSet = new Map<string, MutableFieldGroup>();
  const deferUsages = new Map<string | undefined, DeferUsage>();

  const collectFieldsResult = {
    groupedFieldSet,
    deferUsages,
  };

  collectFieldsImpl(
    schema,
    fragments,
    variableValues,
    operation,
    runtimeType,
    operation.selectionSet,
    collectFieldsResult,
    new Set(),
  );

  return collectFieldsResult;
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
): CollectFieldsResult {
  const subGroupedFieldSet = new Map<string, MutableFieldGroup>();
  const deferUsages = new Map<string | undefined, DeferUsage>();
  const collectSubfieldsResult = {
    groupedFieldSet: subGroupedFieldSet,
    deferUsages,
  };
  const visitedFragmentNames = new Set<string>();

  for (const [deferUsage, fieldNodes] of fieldGroup.fields) {
    for (const node of fieldNodes) {
      if (node.selectionSet) {
        collectFieldsImpl(
          schema,
          fragments,
          variableValues,
          operation,
          returnType,
          node.selectionSet,
          collectSubfieldsResult,
          visitedFragmentNames,
          deferUsage,
        );
      }
    }
  }

  return collectSubfieldsResult;
}

// eslint-disable-next-line max-params
function collectFieldsImpl(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: { [variable: string]: unknown },
  operation: OperationDefinitionNode,
  runtimeType: GraphQLObjectType,
  selectionSet: SelectionSetNode,
  collectFieldsResult: MutableCollectFieldsResult,
  visitedFragmentNames: Set<string>,
  parentDeferUsage?: DeferUsage | undefined,
  newDeferUsage?: DeferUsage | undefined,
): void {
  const { groupedFieldSet } = collectFieldsResult;
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        if (!shouldIncludeNode(variableValues, selection)) {
          continue;
        }
        const key = getFieldEntryKey(selection);
        const fieldGroup = groupedFieldSet.get(key);
        if (fieldGroup) {
          fieldGroup.fields.add(newDeferUsage ?? parentDeferUsage, selection);
          if (newDeferUsage === undefined) {
            if (parentDeferUsage === undefined) {
              fieldGroup.inInitialResult = true;
            }
            fieldGroup.shouldInitiateDefer = false;
          }
        } else {
          const fields = new AccumulatorMap<
            DeferUsage | undefined,
            FieldNode
          >();
          fields.add(newDeferUsage ?? parentDeferUsage, selection);

          let inInitialResult = false;
          let shouldInitiateDefer = true;
          if (newDeferUsage === undefined) {
            if (parentDeferUsage === undefined) {
              inInitialResult = true;
            }
            shouldInitiateDefer = false;
          }

          groupedFieldSet.set(key, {
            parentType: runtimeType,
            fieldName: selection.name.value,
            fields,
            inInitialResult,
            shouldInitiateDefer,
          });
        }
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        if (
          !shouldIncludeNode(variableValues, selection) ||
          !doesFragmentConditionMatch(schema, selection, runtimeType)
        ) {
          continue;
        }

        const defer = getDeferValues(operation, variableValues, selection);

        if (!defer) {
          collectFieldsImpl(
            schema,
            fragments,
            variableValues,
            operation,
            runtimeType,
            selection.selectionSet,
            collectFieldsResult,
            visitedFragmentNames,
            parentDeferUsage,
            newDeferUsage,
          );
          break;
        }

        collectDeferredFragmentFields(
          schema,
          fragments,
          variableValues,
          operation,
          runtimeType,
          selection.selectionSet,
          collectFieldsResult,
          visitedFragmentNames,
          defer,
          parentDeferUsage,
        );
        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragName = selection.name.value;

        if (!shouldIncludeNode(variableValues, selection)) {
          continue;
        }

        const defer = getDeferValues(operation, variableValues, selection);
        if (visitedFragmentNames.has(fragName) && !defer) {
          continue;
        }

        const fragment = fragments[fragName];
        if (
          fragment == null ||
          !doesFragmentConditionMatch(schema, fragment, runtimeType)
        ) {
          continue;
        }

        if (!defer) {
          visitedFragmentNames.add(fragName);
          collectFieldsImpl(
            schema,
            fragments,
            variableValues,
            operation,
            runtimeType,
            fragment.selectionSet,
            collectFieldsResult,
            visitedFragmentNames,
            parentDeferUsage,
            newDeferUsage,
          );
          break;
        }

        collectDeferredFragmentFields(
          schema,
          fragments,
          variableValues,
          operation,
          runtimeType,
          fragment.selectionSet,
          collectFieldsResult,
          visitedFragmentNames,
          defer,
          parentDeferUsage,
        );
        break;
      }
    }
  }
}

// eslint-disable-next-line max-params
function collectDeferredFragmentFields(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: { [variable: string]: unknown },
  operation: OperationDefinitionNode,
  runtimeType: GraphQLObjectType,
  selectionSet: SelectionSetNode,
  collectFieldsResult: MutableCollectFieldsResult,
  visitedFragmentNames: Set<string>,
  defer: { label: string | undefined },
  parentDeferUsage?: DeferUsage | undefined,
): void {
  const deferUsages = collectFieldsResult.deferUsages;
  const existingNewDefer = deferUsages.get(defer.label);
  if (existingNewDefer !== undefined) {
    collectFieldsImpl(
      schema,
      fragments,
      variableValues,
      operation,
      runtimeType,
      selectionSet,
      collectFieldsResult,
      visitedFragmentNames,
      parentDeferUsage,
      existingNewDefer,
    );
    return;
  }

  const newDefer = { ...defer };
  deferUsages.set(defer.label, newDefer);
  collectFieldsImpl(
    schema,
    fragments,
    variableValues,
    operation,
    runtimeType,
    selectionSet,
    collectFieldsResult,
    visitedFragmentNames,
    parentDeferUsage,
    newDefer,
  );
}

/**
 * Returns an object containing the `@defer` arguments if a field should be
 * deferred based on the experimental flag, defer directive present and
 * not disabled by the "if" argument.
 */
function getDeferValues(
  operation: OperationDefinitionNode,
  variableValues: { [variable: string]: unknown },
  node: FragmentSpreadNode | InlineFragmentNode,
): undefined | { label: string | undefined } {
  const defer = getDirectiveValues(GraphQLDeferDirective, node, variableValues);

  if (!defer) {
    return;
  }

  if (defer.if === false) {
    return;
  }

  invariant(
    operation.operation !== OperationTypeNode.SUBSCRIPTION,
    '`@defer` directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
  );

  return {
    label: typeof defer.label === 'string' ? defer.label : undefined,
  };
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
