import { inspect } from '../jsutils/inspect.ts';
import { invariant } from '../jsutils/invariant.ts';
import { isIterableObject } from '../jsutils/isIterableObject.ts';
import { isObjectLike } from '../jsutils/isObjectLike.ts';
import type { Maybe } from '../jsutils/Maybe.ts';
import type { ObjMap } from '../jsutils/ObjMap.ts';

import type { ValueNode, VariableNode } from '../language/ast.ts';
import { Kind } from '../language/kinds.ts';

import type {
  GraphQLDefaultInput,
  GraphQLInputType,
} from '../type/definition.ts';
import {
  assertLeafType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isRequiredInputField,
} from '../type/definition.ts';

import type { FragmentVariableValues } from '../execution/collectFields.ts';
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
    if (!isObjectLike(inputValue) || Array.isArray(inputValue)) {
      return; // Invalid: intentionally return no value.
    }

    const coercedValue: ObjMap<unknown> = Object.create(null);
    const fieldDefs = type.getFields();
    let definedFieldCount = 0;
    for (const fieldName of Object.keys(inputValue)) {
      if (inputValue[fieldName] === undefined) {
        continue;
      }
      definedFieldCount++;
      if (!Object.hasOwn(fieldDefs, fieldName)) {
        return; // Invalid: intentionally return no value.
      }
    }
    for (const field of Object.values(fieldDefs)) {
      const fieldValue = inputValue[field.name];
      if (fieldValue === undefined) {
        if (isRequiredInputField(field)) {
          return; // Invalid: intentionally return no value.
        }
        const coercedDefaultValue = coerceDefaultValue(field);
        if (coercedDefaultValue !== undefined) {
          coercedValue[field.name] = coercedDefaultValue;
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
      if (definedFieldCount !== 1 || keys.length !== 1) {
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
  fragmentVariableValues?: Maybe<FragmentVariableValues>,
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

    const coercedValue: ObjMap<unknown> = Object.create(null);
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
          isMissingVariable(
            fieldNode.value,
            variableValues,
            fragmentVariableValues,
          ))
      ) {
        if (isRequiredInputField(field)) {
          return; // Invalid: intentionally return no value.
        }
        const coercedDefaultValue = coerceDefaultValue(field);
        if (coercedDefaultValue !== undefined) {
          coercedValue[field.name] = coercedDefaultValue;
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
      const coercedKeys = Object.keys(coercedValue);
      if (fieldNodes.size !== 1 || coercedKeys.length !== 1) {
        return; // Invalid: not exactly one key, intentionally return no value.
      }

      for (const [fieldName, fieldNode] of fieldNodes) {
        if (
          fieldNode.value.kind === Kind.NULL ||
          coercedValue[fieldName] === null
        ) {
          return; // Invalid: value not non-null, intentionally return no value.
        }
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
  fragmentVariableValues: Maybe<FragmentVariableValues>,
): unknown {
  const varName = variableNode.name.value;
  if (fragmentVariableValues?.sources[varName] !== undefined) {
    return fragmentVariableValues.coerced[varName];
  }

  return variableValues?.coerced[varName];
}

function isMissingVariable(
  variableNode: VariableNode,
  variableValues: Maybe<VariableValues>,
  fragmentVariableValues: Maybe<FragmentVariableValues>,
): boolean {
  const varName = variableNode.name.value;
  const scopedValues =
    fragmentVariableValues?.sources[varName] !== undefined
      ? fragmentVariableValues.coerced
      : variableValues?.coerced;
  return scopedValues?.[varName] === undefined;
}

interface InputValue {
  type: GraphQLInputType;
  default?: GraphQLDefaultInput | undefined;
  defaultValue?: unknown;
}

/**
 * Returns the coerced default value for an input value definition, if it exists.
 *
 * If the default value is invalid, this will throw an error. Invalid default
 * values should be caught during validation, however, so this function assumes
 * that the default value is valid.
 * @internal
 */
export function coerceDefaultValue(inputValue: InputValue): unknown {
  // Memoize the result of coercing the default value in a hidden field.
  let coercedDefaultValue = (inputValue as any)._memoizedCoercedDefaultValue;
  if (coercedDefaultValue !== undefined) {
    return coercedDefaultValue;
  }

  const defaultInput = inputValue.default;
  if (defaultInput !== undefined) {
    coercedDefaultValue = defaultInput.literal
      ? coerceInputLiteral(defaultInput.literal, inputValue.type)
      : coerceInputValue(defaultInput.value, inputValue.type);
    invariant(
      coercedDefaultValue !== undefined,
      `Expected value of type "${inputValue.type}" to be valid, found: ${inspect(
        defaultInput.literal ?? defaultInput.value,
      )}.`,
    );
    (inputValue as any)._memoizedCoercedDefaultValue = coercedDefaultValue;
    return coercedDefaultValue;
  }

  const defaultValue = inputValue.defaultValue;
  if (defaultValue !== undefined) {
    (inputValue as any)._memoizedCoercedDefaultValue = defaultValue;
  }
  return defaultValue;
}
