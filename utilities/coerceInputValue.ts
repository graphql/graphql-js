import { isIterableObject } from '../jsutils/isIterableObject.ts';
import { isObjectLike } from '../jsutils/isObjectLike.ts';
import type { Maybe } from '../jsutils/Maybe.ts';
import type { ValueNode, VariableNode } from '../language/ast.ts';
import { Kind } from '../language/kinds.ts';
import type {
  GraphQLDefaultValueUsage,
  GraphQLInputType,
} from '../type/definition.ts';
import {
  assertLeafType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isRequiredInputField,
} from '../type/definition.ts';
import type { VariableValues } from '../execution/values.ts';
import { replaceVariables } from './replaceVariables.ts';
/**
 * Coerces a JavaScript value given a GraphQL Input Type.
 *
 * Returns `undefined` when the value could not be validly coerced according to
 * the provided type.
 */
export function coerceInputValue(
  inputValue: unknown,
  type: GraphQLInputType,
): unknown {
  if (isNonNullType(type)) {
    if (inputValue == null) {
      return; // Invalid: intentionally return no value.
    }
    return coerceInputValue(inputValue, type.ofType);
  }
  if (inputValue == null) {
    return null; // Explicitly return the value null.
  }
  if (isListType(type)) {
    if (!isIterableObject(inputValue)) {
      // Lists accept a non-list value as a list of one.
      const coercedItem = coerceInputValue(inputValue, type.ofType);
      if (coercedItem === undefined) {
        return; // Invalid: intentionally return no value.
      }
      return [coercedItem];
    }
    const coercedValue = [];
    for (const itemValue of inputValue) {
      const coercedItem = coerceInputValue(itemValue, type.ofType);
      if (coercedItem === undefined) {
        return; // Invalid: intentionally return no value.
      }
      coercedValue.push(coercedItem);
    }
    return coercedValue;
  }
  if (isInputObjectType(type)) {
    if (!isObjectLike(inputValue)) {
      return; // Invalid: intentionally return no value.
    }
    const coercedValue: any = {};
    const fieldDefs = type.getFields();
    const hasUndefinedField = Object.keys(inputValue).some(
      (name) => !Object.hasOwn(fieldDefs, name),
    );
    if (hasUndefinedField) {
      return; // Invalid: intentionally return no value.
    }
    for (const field of Object.values(fieldDefs)) {
      const fieldValue = inputValue[field.name];
      if (fieldValue === undefined) {
        if (isRequiredInputField(field)) {
          return; // Invalid: intentionally return no value.
        }
        if (field.defaultValue) {
          coercedValue[field.name] = coerceDefaultValue(
            field.defaultValue,
            field.type,
          );
        }
      } else {
        const coercedField = coerceInputValue(fieldValue, field.type);
        if (coercedField === undefined) {
          return; // Invalid: intentionally return no value.
        }
        coercedValue[field.name] = coercedField;
      }
    }
    if (type.isOneOf) {
      const keys = Object.keys(coercedValue);
      if (keys.length !== 1) {
        return; // Invalid: intentionally return no value.
      }
      const key = keys[0];
      const value = coercedValue[key];
      if (value === null) {
        return; // Invalid: intentionally return no value.
      }
    }
    return coercedValue;
  }
  const leafType = assertLeafType(type);
  try {
    return leafType.coerceInputValue(inputValue);
  } catch (_error) {
    // Invalid: ignore error and intentionally return no value.
  }
}
/**
 * Produces a coerced "internal" JavaScript value given a GraphQL Value AST.
 *
 * Returns `undefined` when the value could not be validly coerced according to
 * the provided type.
 */
export function coerceInputLiteral(
  valueNode: ValueNode,
  type: GraphQLInputType,
  variableValues?: Maybe<VariableValues>,
  fragmentVariableValues?: Maybe<VariableValues>,
): unknown {
  if (valueNode.kind === Kind.VARIABLE) {
    const coercedVariableValue = getCoercedVariableValue(
      valueNode,
      variableValues,
      fragmentVariableValues,
    );
    if (coercedVariableValue == null && isNonNullType(type)) {
      return; // Invalid: intentionally return no value.
    }
    // Note: This does no further checking that this variable is correct.
    // This assumes validated has checked this variable is of the correct type.
    return coercedVariableValue;
  }
  if (isNonNullType(type)) {
    if (valueNode.kind === Kind.NULL) {
      return; // Invalid: intentionally return no value.
    }
    return coerceInputLiteral(
      valueNode,
      type.ofType,
      variableValues,
      fragmentVariableValues,
    );
  }
  if (valueNode.kind === Kind.NULL) {
    return null; // Explicitly return the value null.
  }
  if (isListType(type)) {
    if (valueNode.kind !== Kind.LIST) {
      // Lists accept a non-list value as a list of one.
      const itemValue = coerceInputLiteral(
        valueNode,
        type.ofType,
        variableValues,
        fragmentVariableValues,
      );
      if (itemValue === undefined) {
        return; // Invalid: intentionally return no value.
      }
      return [itemValue];
    }
    const coercedValue: Array<unknown> = [];
    for (const itemNode of valueNode.values) {
      let itemValue = coerceInputLiteral(
        itemNode,
        type.ofType,
        variableValues,
        fragmentVariableValues,
      );
      if (itemValue === undefined) {
        if (
          itemNode.kind === Kind.VARIABLE &&
          getCoercedVariableValue(
            itemNode,
            variableValues,
            fragmentVariableValues,
          ) == null &&
          !isNonNullType(type.ofType)
        ) {
          // A missing variable within a list is coerced to null.
          itemValue = null;
        } else {
          return; // Invalid: intentionally return no value.
        }
      }
      coercedValue.push(itemValue);
    }
    return coercedValue;
  }
  if (isInputObjectType(type)) {
    if (valueNode.kind !== Kind.OBJECT) {
      return; // Invalid: intentionally return no value.
    }
    const coercedValue: {
      [field: string]: unknown;
    } = {};
    const fieldDefs = type.getFields();
    const hasUndefinedField = valueNode.fields.some(
      (field) => !Object.hasOwn(fieldDefs, field.name.value),
    );
    if (hasUndefinedField) {
      return; // Invalid: intentionally return no value.
    }
    const fieldNodes = new Map(
      valueNode.fields.map((field) => [field.name.value, field]),
    );
    for (const field of Object.values(fieldDefs)) {
      const fieldNode = fieldNodes.get(field.name);
      if (
        !fieldNode ||
        (fieldNode.value.kind === Kind.VARIABLE &&
          getCoercedVariableValue(
            fieldNode.value,
            variableValues,
            fragmentVariableValues,
          ) == null)
      ) {
        if (isRequiredInputField(field)) {
          return; // Invalid: intentionally return no value.
        }
        if (field.defaultValue) {
          coercedValue[field.name] = coerceDefaultValue(
            field.defaultValue,
            field.type,
          );
        }
      } else {
        const fieldValue = coerceInputLiteral(
          fieldNode.value,
          field.type,
          variableValues,
          fragmentVariableValues,
        );
        if (fieldValue === undefined) {
          return; // Invalid: intentionally return no value.
        }
        coercedValue[field.name] = fieldValue;
      }
    }
    if (type.isOneOf) {
      const keys = Object.keys(coercedValue);
      if (keys.length !== 1) {
        return; // Invalid: not exactly one key, intentionally return no value.
      }
      if (coercedValue[keys[0]] === null) {
        return; // Invalid: value not non-null, intentionally return no value.
      }
    }
    return coercedValue;
  }
  const leafType = assertLeafType(type);
  try {
    return leafType.coerceInputLiteral
      ? leafType.coerceInputLiteral(
          replaceVariables(valueNode, variableValues, fragmentVariableValues),
        )
      : leafType.parseLiteral(valueNode, variableValues?.coerced);
  } catch (_error) {
    // Invalid: ignore error and intentionally return no value.
  }
}
// Retrieves the variable value for the given variable node.
function getCoercedVariableValue(
  variableNode: VariableNode,
  variableValues: Maybe<VariableValues>,
  fragmentVariableValues: Maybe<VariableValues>,
): unknown {
  const varName = variableNode.name.value;
  if (fragmentVariableValues?.sources[varName] !== undefined) {
    return fragmentVariableValues.coerced[varName];
  }
  return variableValues?.coerced[varName];
}
/**
 * @internal
 */
export function coerceDefaultValue(
  defaultValue: GraphQLDefaultValueUsage,
  type: GraphQLInputType,
): unknown {
  // Memoize the result of coercing the default value in a hidden field.
  let coercedValue = (defaultValue as any)._memoizedCoercedValue;
  if (coercedValue === undefined) {
    coercedValue = defaultValue.literal
      ? coerceInputLiteral(defaultValue.literal, type)
      : defaultValue.value;
    (defaultValue as any)._memoizedCoercedValue = coercedValue;
  }
  return coercedValue;
}
