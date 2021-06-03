import type { Maybe } from '../jsutils/Maybe';
import { hasOwnProperty } from '../jsutils/hasOwnProperty';
import { invariant } from '../jsutils/invariant';
import { isIterableObject } from '../jsutils/isIterableObject';
import { isObjectLike } from '../jsutils/isObjectLike';
import { keyMap } from '../jsutils/keyMap';

import type {
  GraphQLInputType,
  GraphQLDefaultValueUsage,
} from '../type/definition';
import {
  assertLeafType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isRequiredInputField,
} from '../type/definition';

import type { ValueNode } from '../language/ast';
import { Kind } from '../language/kinds';

import type { VariableValues } from '../execution/values';

import { replaceVariables } from './replaceVariables';

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
      (name) => !hasOwnProperty(fieldDefs, name),
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
    return coercedValue;
  }

  const leafType = assertLeafType(type);

  try {
    return leafType.parseValue(inputValue);
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
): unknown {
  if (valueNode.kind === Kind.VARIABLE) {
    if (!variableValues || isMissingVariable(valueNode, variableValues)) {
      return; // Invalid: intentionally return no value.
    }
    const coercedVariableValue = variableValues.coerced[valueNode.name.value];
    if (coercedVariableValue === null && isNonNullType(type)) {
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
    return coerceInputLiteral(valueNode, type.ofType, variableValues);
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
      );
      if (itemValue === undefined) {
        return; // Invalid: intentionally return no value.
      }
      return [itemValue];
    }
    const coercedValue: Array<unknown> = [];
    for (const itemNode of valueNode.values) {
      let itemValue = coerceInputLiteral(itemNode, type.ofType, variableValues);
      if (itemValue === undefined) {
        if (
          isMissingVariable(itemNode, variableValues) &&
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

    const coercedValue: { [field: string]: unknown } = {};
    const fieldDefs = type.getFields();
    const hasUndefinedField = valueNode.fields.some(
      (field) => !hasOwnProperty(fieldDefs, field.name.value),
    );
    if (hasUndefinedField) {
      return; // Invalid: intentionally return no value.
    }
    const fieldNodes = keyMap(valueNode.fields, (field) => field.name.value);
    for (const field of Object.values(fieldDefs)) {
      const fieldNode = fieldNodes[field.name];
      if (!fieldNode || isMissingVariable(fieldNode.value, variableValues)) {
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
        );
        if (fieldValue === undefined) {
          return; // Invalid: intentionally return no value.
        }
        coercedValue[field.name] = fieldValue;
      }
    }
    return coercedValue;
  }

  const leafType = assertLeafType(type);
  const constValueNode = replaceVariables(valueNode, variableValues);

  try {
    return leafType.parseLiteral(constValueNode);
  } catch (_error) {
    // Invalid: ignore error and intentionally return no value.
  }
}

// Returns true if the provided valueNode is a variable which is not defined
// in the set of variables.
function isMissingVariable(
  valueNode: ValueNode,
  variables: Maybe<VariableValues>,
): boolean {
  return (
    valueNode.kind === Kind.VARIABLE &&
    (variables == null || variables.coerced[valueNode.name.value] === undefined)
  );
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
  // istanbul ignore else (memoized case)
  if (coercedValue === undefined) {
    coercedValue = defaultValue.literal
      ? coerceInputLiteral(defaultValue.literal, type)
      : coerceInputValue(defaultValue.value, type);
    invariant(coercedValue !== undefined);
    (defaultValue as any)._memoizedCoercedValue = coercedValue;
  }
  return coercedValue;
}
