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
export interface PatchFields {
  label: string | undefined;
  fields: Map<string, ReadonlyArray<FieldNode>>;
}
export interface FieldsAndPatches {
  fields: Map<string, ReadonlyArray<FieldNode>>;
  patches: Array<PatchFields>;
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
): FieldsAndPatches {
  const fields = new AccumulatorMap<string, FieldNode>();
  const patches: Array<PatchFields> = [];
  collectFieldsImpl(
    schema,
    fragments,
    variableValues,
    operation,
    runtimeType,
    operation.selectionSet,
    fields,
    patches,
    new Set(),
  );
  return { fields, patches };
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
  fieldNodes: ReadonlyArray<FieldNode>,
): FieldsAndPatches {
  const subFieldNodes = new AccumulatorMap<string, FieldNode>();
  const visitedFragmentNames = new Set<string>();
  const subPatches: Array<PatchFields> = [];
  const subFieldsAndPatches = {
    fields: subFieldNodes,
    patches: subPatches,
  };
  for (const node of fieldNodes) {
    if (node.selectionSet) {
      collectFieldsImpl(
        schema,
        fragments,
        variableValues,
        operation,
        returnType,
        node.selectionSet,
        subFieldNodes,
        subPatches,
        visitedFragmentNames,
      );
    }
  }
  return subFieldsAndPatches;
}
// eslint-disable-next-line max-params
function collectFieldsImpl(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: {
    [variable: string]: unknown;
  },
  operation: OperationDefinitionNode,
  runtimeType: GraphQLObjectType,
  selectionSet: SelectionSetNode,
  fields: AccumulatorMap<string, FieldNode>,
  patches: Array<PatchFields>,
  visitedFragmentNames: Set<string>,
): void {
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        if (!shouldIncludeNode(variableValues, selection)) {
          continue;
        }
        fields.add(getFieldEntryKey(selection), selection);
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
        if (defer) {
          const patchFields = new AccumulatorMap<string, FieldNode>();
          collectFieldsImpl(
            schema,
            fragments,
            variableValues,
            operation,
            runtimeType,
            selection.selectionSet,
            patchFields,
            patches,
            visitedFragmentNames,
          );
          patches.push({
            label: defer.label,
            fields: patchFields,
          });
        } else {
          collectFieldsImpl(
            schema,
            fragments,
            variableValues,
            operation,
            runtimeType,
            selection.selectionSet,
            fields,
            patches,
            visitedFragmentNames,
          );
        }
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
          !fragment ||
          !doesFragmentConditionMatch(schema, fragment, runtimeType)
        ) {
          continue;
        }
        if (!defer) {
          visitedFragmentNames.add(fragName);
        }
        if (defer) {
          const patchFields = new AccumulatorMap<string, FieldNode>();
          collectFieldsImpl(
            schema,
            fragments,
            variableValues,
            operation,
            runtimeType,
            fragment.selectionSet,
            patchFields,
            patches,
            visitedFragmentNames,
          );
          patches.push({
            label: defer.label,
            fields: patchFields,
          });
        } else {
          collectFieldsImpl(
            schema,
            fragments,
            variableValues,
            operation,
            runtimeType,
            fragment.selectionSet,
            fields,
            patches,
            visitedFragmentNames,
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
function getDeferValues(
  operation: OperationDefinitionNode,
  variableValues: {
    [variable: string]: unknown;
  },
  node: FragmentSpreadNode | InlineFragmentNode,
):
  | undefined
  | {
      label: string | undefined;
    } {
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
