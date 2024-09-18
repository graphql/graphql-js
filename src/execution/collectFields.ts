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

import type { GraphQLVariableSignature } from '../utilities/getVariableSignature';
import { typeFromAST } from '../utilities/typeFromAST';

import { experimentalGetArgumentValues, getDirectiveValues } from './values';

export interface FragmentVariables {
  signatures: ObjMap<GraphQLVariableSignature>;
  values: ObjMap<unknown>;
}

export interface FieldDetails {
  node: FieldNode;
  fragmentVariables?: FragmentVariables | undefined;
}

export interface FragmentDetails {
  definition: FragmentDefinitionNode;
  variableSignatures?: ObjMap<GraphQLVariableSignature> | undefined;
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
  fragments: ObjMap<FragmentDetails>,
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
    undefined,
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
  fragments: ObjMap<FragmentDetails>,
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
        entry.fragmentVariables,
      );
    }
  }
  return subFieldEntries;
}

function collectFieldsImpl(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDetails>,
  variableValues: { [variable: string]: unknown },
  runtimeType: GraphQLObjectType,
  selectionSet: SelectionSetNode,
  fields: Map<string, Array<FieldDetails>>,
  visitedFragmentNames: Set<string>,
  fragmentVariables?: FragmentVariables,
): void {
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        if (!shouldIncludeNode(selection, variableValues, fragmentVariables)) {
          continue;
        }
        const name = getFieldEntryKey(selection);
        const fieldList = fields.get(name);
        if (fieldList !== undefined) {
          fieldList.push({
            node: selection,
            fragmentVariables,
          });
        } else {
          fields.set(name, [
            {
              node: selection,
              fragmentVariables,
            },
          ]);
        }
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        if (
          !shouldIncludeNode(selection, variableValues, fragmentVariables) ||
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
          fragmentVariables,
        );
        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragName = selection.name.value;
        if (
          visitedFragmentNames.has(fragName) ||
          !shouldIncludeNode(selection, variableValues, fragmentVariables)
        ) {
          continue;
        }
        visitedFragmentNames.add(fragName);
        const fragment = fragments[fragName];
        if (
          !fragment ||
          !doesFragmentConditionMatch(schema, fragment.definition, runtimeType)
        ) {
          continue;
        }

        const fragmentVariableSignatures = fragment.variableSignatures;
        let newFragmentVariables: FragmentVariables | undefined;
        if (fragmentVariableSignatures) {
          newFragmentVariables = {
            signatures: fragmentVariableSignatures,
            values: experimentalGetArgumentValues(
              selection,
              Object.values(fragmentVariableSignatures),
              variableValues,
              fragmentVariables,
            ),
          };
        }

        collectFieldsImpl(
          schema,
          fragments,
          variableValues,
          runtimeType,
          fragment.definition.selectionSet,
          fields,
          visitedFragmentNames,
          newFragmentVariables,
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
  variableValues: { [variable: string]: unknown },
  fragmentVariables: FragmentVariables | undefined,
): boolean {
  const skip = getDirectiveValues(
    GraphQLSkipDirective,
    node,
    variableValues,
    fragmentVariables,
  );
  if (skip?.if === true) {
    return false;
  }

  const include = getDirectiveValues(
    GraphQLIncludeDirective,
    node,
    variableValues,
    fragmentVariables,
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
