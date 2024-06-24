import type { ObjMap } from '../jsutils/ObjMap';

import type {
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  SelectionSetNode,
} from '../language/ast';
import { Kind } from '../language/kinds';

import type { GraphQLObjectType } from '../type/definition';
import { isAbstractType } from '../type/definition';
import {
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
} from '../type/directives';
import type { GraphQLSchema } from '../type/schema';

import { typeFromAST } from '../utilities/typeFromAST';

import { getDirectiveValues } from './values';

interface FieldEntry {
  selection: FieldNode;
  name: string;
}

interface EntryWithSelectionset {
  selectionSet: SelectionSetNode;
  runtimeType: GraphQLObjectType;
}

type StackEntry = EntryWithSelectionset | FieldEntry;

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
  selectionSet: SelectionSetNode,
): Map<string, ReadonlyArray<FieldNode>> {
  const stack: Array<StackEntry> = [{ selectionSet, runtimeType }];
  const fields = new Map();
  const visited = new Set<string>();

  let entry;
  while ((entry = stack.shift()) !== undefined) {
    if ('selectionSet' in entry) {
      collectFieldsImpl(
        schema,
        fragments,
        variableValues,
        entry.runtimeType,
        entry.selectionSet,
        visited,
        stack,
      );
    } else {
      const fieldList = fields.get(entry.name);
      if (fieldList !== undefined) {
        fieldList.push(entry.selection);
      } else {
        fields.set(entry.name, [entry.selection]);
      }
    }
  }

  return fields;
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
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: { [variable: string]: unknown },
  returnType: GraphQLObjectType,
  fieldNodes: ReadonlyArray<FieldNode>,
): Map<string, ReadonlyArray<FieldNode>> {
  const subFieldNodes = new Map();
  const stack: Array<StackEntry> = [];
  const visitedFragmentNames = new Set<string>();
  for (const node of fieldNodes) {
    if (node.selectionSet) {
      stack.push({ selectionSet: node.selectionSet, runtimeType: returnType });
    }
  }

  let entry;
  while ((entry = stack.shift()) !== undefined) {
    if ('selectionSet' in entry) {
      collectFieldsImpl(
        schema,
        fragments,
        variableValues,
        entry.runtimeType,
        entry.selectionSet,
        visitedFragmentNames,
        stack,
      );
    } else {
      const fieldList = subFieldNodes.get(entry.name);
      if (fieldList !== undefined) {
        fieldList.push(entry.selection);
      } else {
        subFieldNodes.set(entry.name, [entry.selection]);
      }
    }
  }

  return subFieldNodes;
}

function collectFieldsImpl(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: { [variable: string]: unknown },
  runtimeType: GraphQLObjectType,
  selectionSet: SelectionSetNode,
  visitedFragmentNames: Set<string>,
  stack: Array<StackEntry>,
): void {
  const discovered = [];
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        if (!shouldIncludeNode(variableValues, selection)) {
          continue;
        }
        const name = getFieldEntryKey(selection);
        discovered.push({ selection, name });
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        if (
          !shouldIncludeNode(variableValues, selection) ||
          !doesFragmentConditionMatch(schema, selection, runtimeType)
        ) {
          continue;
        }
        discovered.push({ selectionSet: selection.selectionSet, runtimeType });
        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragName = selection.name.value;
        if (
          visitedFragmentNames.has(fragName) ||
          !shouldIncludeNode(variableValues, selection)
        ) {
          continue;
        }
        visitedFragmentNames.add(fragName);
        const fragment = fragments[fragName];
        if (
          !fragment ||
          !doesFragmentConditionMatch(schema, fragment, runtimeType)
        ) {
          continue;
        }

        discovered.push({ selectionSet: fragment.selectionSet, runtimeType });
        break;
      }
    }
  }

  if (discovered.length !== 0) {
    stack.unshift(...discovered);
  }
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
