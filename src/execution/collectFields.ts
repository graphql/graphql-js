import type { ObjMap } from '../jsutils/ObjMap';

import type {
  SelectionSetNode,
  FieldNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  FragmentDefinitionNode,
} from '../language/ast';
import { Kind } from '../language/kinds';

import type { GraphQLSchema } from '../type/schema';
import type { GraphQLObjectType } from '../type/definition';
import {
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  GraphQLDeferDirective,
} from '../type/directives';
import { isAbstractType } from '../type/definition';

import { typeFromAST } from '../utilities/typeFromAST';

import { getDirectiveValues } from './values';

export interface PatchFields {
  label?: string;
  fields: Map<string, ReadonlyArray<FieldNode>>;
}

export interface FieldsAndPatches {
  fields: Map<string, ReadonlyArray<FieldNode>>;
  patches: Array<PatchFields>;
}

/**
 * Given a selectionSet, collect all of the fields and returns it at the end.
 *
 * CollectFields requires the "runtime type" of an object. For a field which
 * returns an Interface or Union type, the "runtime type" will be the actual
 * Object type returned by that field.
 *
 * @internal
 */
export function collectFields(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: { [variable: string]: unknown },
  runtimeType: GraphQLObjectType,
  selectionSet: SelectionSetNode,
): FieldsAndPatches {
  const fields = new Map();
  const patches: Array<PatchFields> = [];
  collectFieldsImpl(
    schema,
    fragments,
    variableValues,
    runtimeType,
    selectionSet,
    fields,
    patches,
    new Set(),
  );
  return { fields, patches };
}

/**
 * Given an array of field nodes, collects all of the subfields of the passed
 * in fields, and returns it at the end.
 *
 * CollectFields requires the "return type" of an object. For a field which
 * returns an Interface or Union type, the "return type" will be the actual
 * Object type returned by that field.
 *
 * @internal
 */
export function collectSubfields(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: { [variable: string]: unknown },
  returnType: GraphQLObjectType,
  fieldNodes: ReadonlyArray<FieldNode>,
): FieldsAndPatches {
  const subFieldNodes = new Map();
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

function collectFieldsImpl(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: { [variable: string]: unknown },
  runtimeType: GraphQLObjectType,
  selectionSet: SelectionSetNode,
  fields: Map<string, Array<FieldNode>>,
  patches: Array<PatchFields>,
  visitedFragmentNames: Set<string>,
): void {
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        if (!shouldIncludeNode(variableValues, selection)) {
          continue;
        }
        const name = getFieldEntryKey(selection);
        const fieldList = fields.get(name);
        if (fieldList !== undefined) {
          fieldList.push(selection);
        } else {
          fields.set(name, [selection]);
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

        const defer = getDeferValues(schema, variableValues, selection);

        if (defer) {
          const patchFields = new Map();
          collectFieldsImpl(
            schema,
            fragments,
            variableValues,
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

        const defer = getDeferValues(schema, variableValues, selection);
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

        visitedFragmentNames.add(fragName);

        if (defer) {
          const patchFields = new Map();
          collectFieldsImpl(
            schema,
            fragments,
            variableValues,
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
  schema: GraphQLSchema,
  variableValues: { [variable: string]: unknown },
  node: FragmentSpreadNode | InlineFragmentNode,
): undefined | { label?: string } {
  if (schema._enableDeferStream !== true) {
    return;
  }

  const defer = getDirectiveValues(GraphQLDeferDirective, node, variableValues);

  if (!defer) {
    return;
  }

  if (defer.if === false) {
    return;
  }

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
