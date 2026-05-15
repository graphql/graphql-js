/** @category Values */

import { inspect } from '../jsutils/inspect.ts';
import { invariant } from '../jsutils/invariant.ts';
import type { Maybe } from '../jsutils/Maybe.ts';
import type { ObjMap } from '../jsutils/ObjMap.ts';

import type { ValueNode } from '../language/ast.ts';
import { Kind } from '../language/kinds.ts';

import type { GraphQLInputType } from '../type/definition.ts';
import {
  isInputObjectType,
  isLeafType,
  isListType,
  isNonNullType,
} from '../type/definition.ts';

/**
 * Produces a JavaScript value given a GraphQL Value AST.
 *
 * A GraphQL type must be provided, which will be used to interpret different
 * GraphQL Value literals.
 *
 * Returns `undefined` when the value could not be validly coerced according to
 * the provided type.
 *
 * | GraphQL Value        | JSON Value    |
 * | -------------------- | ------------- |
 * | Input Object         | Object        |
 * | List                 | Array         |
 * | Boolean              | Boolean       |
 * | String               | String        |
 * | Int / Float          | Number        |
 * | Enum Value           | Unknown       |
 * | NullValue            | null          |
 * @param valueNode - GraphQL value AST node to convert.
 * @param type - The GraphQL type to inspect.
 * @param variables - Optional runtime variable values keyed by variable name.
 * @returns The coerced JavaScript value, or undefined if the AST value cannot be coerced to the type.
 * @example
 * ```ts
 * // Coerce literal values without variables.
 * import { parseValue } from 'graphql/language';
 * import {
 *   GraphQLInputObjectType,
 *   GraphQLInt,
 *   GraphQLList,
 *   GraphQLNonNull,
 *   GraphQLString,
 * } from 'graphql/type';
 * import { valueFromAST } from 'graphql/utilities';
 *
 * const ReviewInput = new GraphQLInputObjectType({
 *   name: 'ReviewInput',
 *   fields: {
 *     stars: { type: new GraphQLNonNull(GraphQLInt) },
 *     tags: { type: new GraphQLList(GraphQLString) },
 *   },
 * });
 *
 * valueFromAST(parseValue('{ stars: 5, tags: ["featured"] }'), ReviewInput); // => { stars: 5, tags: ['featured'] }
 * valueFromAST(parseValue('{ stars: "bad" }'), ReviewInput); // => undefined
 * ```
 * @example
 * ```ts
 * // This variant resolves variable references from runtime values.
 * import { parseValue } from 'graphql/language';
 * import { GraphQLInt } from 'graphql/type';
 * import { valueFromAST } from 'graphql/utilities';
 *
 * valueFromAST(parseValue('$stars'), GraphQLInt, { stars: 5 }); // => 5
 * valueFromAST(parseValue('$stars'), GraphQLInt, {}); // => undefined
 * ```
 * @deprecated use `coerceInputLiteral()` instead - will be removed in v18
 */
export function valueFromAST(
  valueNode: Maybe<ValueNode>,
  type: GraphQLInputType,
  variables?: Maybe<ObjMap<unknown>>,
): unknown {
  if (!valueNode) {
    // When there is no node, then there is also no value.
    // Importantly, this is different from returning the value null.
    return;
  }

  if (valueNode.kind === Kind.VARIABLE) {
    const variableName = valueNode.name.value;
    if (variables == null || !Object.hasOwn(variables, variableName)) {
      // No valid return value.
      return;
    }
    const variableValue = variables[variableName];
    if (variableValue === undefined) {
      // No valid return value.
      return;
    }
    if (variableValue === null && isNonNullType(type)) {
      return; // Invalid: intentionally return no value.
    }
    // Note: This does no further checking that this variable is correct.
    // This assumes that this query has been validated and the variable
    // usage here is of the correct type.
    return variableValue;
  }

  if (isNonNullType(type)) {
    if (valueNode.kind === Kind.NULL) {
      return; // Invalid: intentionally return no value.
    }
    return valueFromAST(valueNode, type.ofType, variables);
  }

  if (valueNode.kind === Kind.NULL) {
    // This is explicitly returning the value null.
    return null;
  }

  if (isListType(type)) {
    const itemType = type.ofType;
    if (valueNode.kind === Kind.LIST) {
      const coercedValues = [];
      for (const itemNode of valueNode.values) {
        if (isMissingVariable(itemNode, variables)) {
          // If an array contains a missing variable, it is either coerced to
          // null or if the item type is non-null, it considered invalid.
          if (isNonNullType(itemType)) {
            return; // Invalid: intentionally return no value.
          }
          coercedValues.push(null);
        } else {
          const itemValue = valueFromAST(itemNode, itemType, variables);
          if (itemValue === undefined) {
            return; // Invalid: intentionally return no value.
          }
          coercedValues.push(itemValue);
        }
      }
      return coercedValues;
    }
    const coercedValue = valueFromAST(valueNode, itemType, variables);
    if (coercedValue === undefined) {
      return; // Invalid: intentionally return no value.
    }
    return [coercedValue];
  }

  if (isInputObjectType(type)) {
    if (valueNode.kind !== Kind.OBJECT) {
      return; // Invalid: intentionally return no value.
    }
    const coercedObj = Object.create(null);
    const fieldDefs = type.getFields();
    const hasUnknownField = valueNode.fields.some(
      (field) => !Object.hasOwn(fieldDefs, field.name.value),
    );
    if (hasUnknownField) {
      return; // Invalid: intentionally return no value.
    }
    const fieldNodes = new Map(
      valueNode.fields.map((field) => [field.name.value, field]),
    );
    for (const field of Object.values(fieldDefs)) {
      const fieldNode = fieldNodes.get(field.name);
      if (fieldNode == null || isMissingVariable(fieldNode.value, variables)) {
        if (field.defaultValue !== undefined) {
          coercedObj[field.name] = field.defaultValue;
        } else if (isNonNullType(field.type)) {
          return; // Invalid: intentionally return no value.
        }
        continue;
      }
      const fieldValue = valueFromAST(fieldNode.value, field.type, variables);
      if (fieldValue === undefined) {
        return; // Invalid: intentionally return no value.
      }
      coercedObj[field.name] = fieldValue;
    }

    if (type.isOneOf) {
      const coercedKeys = Object.keys(coercedObj);
      if (fieldNodes.size !== 1 || coercedKeys.length !== 1) {
        return; // Invalid: not exactly one key, intentionally return no value.
      }

      for (const [fieldName, fieldNode] of fieldNodes) {
        if (
          fieldNode.value.kind === Kind.NULL ||
          coercedObj[fieldName] === null
        ) {
          return; // Invalid: value not non-null, intentionally return no value.
        }
      }
    }

    return coercedObj;
  }

  if (isLeafType(type)) {
    // Scalars and Enums fulfill parsing a literal value via parseLiteral().
    // Invalid values represent a failure to parse correctly, in which case
    // no value is returned.
    let result;
    try {
      result = type.parseLiteral(valueNode, variables);
    } catch (_error) {
      return; // Invalid: intentionally return no value.
    }
    if (result === undefined) {
      return; // Invalid: intentionally return no value.
    }
    return result;
    /* node:coverage ignore next 4 */
  }
  // Not reachable, all possible input types have been considered.
  invariant(false, 'Unexpected input type: ' + inspect(type));
}

// Returns true if the provided valueNode is a variable which is not defined
// in the set of variables.
function isMissingVariable(
  valueNode: ValueNode,
  variables: Maybe<ObjMap<unknown>>,
): boolean {
  return (
    valueNode.kind === Kind.VARIABLE &&
    (variables?.[valueNode.name.value] === undefined ||
      !Object.hasOwn(variables, valueNode.name.value))
  );
}
