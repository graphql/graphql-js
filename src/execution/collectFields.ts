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

import { getArgumentValuesFromSpread, getDirectiveValues } from './values';

export interface FieldDetails {
  node: FieldNode;
  fragmentVariableValues?: ObjMap<unknown> | undefined;
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
  selectionSet: SelectionSetNode,
): Map<string, ReadonlyArray<FieldDetails>> {
  const fields = new Map();
  collectFieldsImpl(
    schema,
    fragments,
    variableValues,
    runtimeType,
    selectionSet,
    fields,
    new Set(),
    undefined
  );
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
  fieldEntries: ReadonlyArray<FieldDetails>,
): Map<string, ReadonlyArray<FieldDetails>> {
  const subFieldEntries = new Map();
  const visitedFragmentNames = new Set<string>();
  for (const entry of fieldEntries) {
    if (entry.node.selectionSet) {
      collectFieldsImpl(
        schema,
        fragments,
        variableValues,
        returnType,
        entry.node.selectionSet,
        subFieldEntries,
        visitedFragmentNames,
      );
    }
  }
  return subFieldEntries;
}

function collectFieldsImpl(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: { [variable: string]: unknown },
  runtimeType: GraphQLObjectType,
  selectionSet: SelectionSetNode,
  fields: Map<string, Array<FieldDetails>>,
  visitedFragmentNames: Set<string>,
  localVariableValues?: { [variable: string]: unknown },
): void {
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        const vars = localVariableValues ?? variableValues;
        if (!shouldIncludeNode(vars, selection)) {
          continue;
        }
        const name = getFieldEntryKey(selection);
        const fieldList = fields.get(name);
        if (fieldList !== undefined) {
          fieldList.push({ node: selection, fragmentVariableValues: localVariableValues ?? undefined });
        } else {
          fields.set(name, [{ node: selection, fragmentVariableValues: localVariableValues ?? undefined }]);
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
        collectFieldsImpl(
          schema,
          fragments,
          variableValues,
          runtimeType,
          selection.selectionSet,
          fields,
          visitedFragmentNames,
        );
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

        // We need to introduce a concept of shadowing:
        //
        // - when a fragment defines a variable that is in the parent scope but not given
        //   in the fragment-spread we need to look at this variable as undefined and check
        //   whether the definition has a defaultValue, if not remove it from the variableValues.
        // - when a fragment does not define a variable we need to copy it over from the parent
        //   scope as that variable can still get used in spreads later on in the selectionSet.
        // - when a value is passed in through the fragment-spread we need to copy over the key-value
        //   into our variable-values.
        const fragmentVariableValues = fragment.variableDefinitions
          ? getArgumentValuesFromSpread(
              selection,
              schema,
              fragment.variableDefinitions,
              variableValues,
              localVariableValues,
            )
          : undefined;

        collectFieldsImpl(
          schema,
          fragments,
          variableValues,
          runtimeType,
          fragment.selectionSet,
          fields,
          visitedFragmentNames,
          fragmentVariableValues
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
