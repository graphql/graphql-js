import { inspect } from '../../jsutils/inspect.ts';
import { invariant } from '../../jsutils/invariant.ts';
import { isIterableObject } from '../../jsutils/isIterableObject.ts';
import { isObjectLike } from '../../jsutils/isObjectLike.ts';
import type { Maybe } from '../../jsutils/Maybe.ts';
import type { ObjMap } from '../../jsutils/ObjMap.ts';

import { ensureGraphQLError } from '../../error/ensureGraphQLError.ts';
import type { GraphQLError } from '../../error/GraphQLError.ts';

import type { ObjectFieldNode, ValueNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import type {
  GraphQLDefaultInput,
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLLeafType,
} from '../../type/definition.ts';
import {
  assertLeafType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isRequiredInputField,
} from '../../type/definition.ts';

import { replaceVariables } from '../../utilities/replaceVariables.ts';

import type { FragmentVariableValues } from '../collectFields.ts';
import type { VariableValues } from '../values.ts';

/** @internal */
export type InputValueCoercer = (inputValue: unknown) => unknown;

/** @internal */
export type InputLiteralCoercer = (
  variableValues?: Maybe<VariableValues>,
  fragmentVariableValues?: Maybe<FragmentVariableValues>,
) => unknown;

interface InputObjectFieldDefinition {
  name: string;
  defaultValue: CompiledDefaultInputValue;
  isRequired: boolean;
}

type InputObjectLiteralField =
  | MissingInputObjectLiteralField
  | PresentInputObjectLiteralField;

interface MissingInputObjectLiteralField extends InputObjectFieldDefinition {
  kind: 'missing';
}

interface PresentInputObjectLiteralField extends InputObjectFieldDefinition {
  kind: 'present';
  valueNode: ValueNode;
  valueBuilder: InputLiteralCoercer;
}

interface CompiledDefaultInputValue {
  value: unknown;
  error: GraphQLError | undefined;
}

interface InputValue {
  type: GraphQLInputType;
  default?: GraphQLDefaultInput | undefined;
  defaultValue?: unknown;
  /** @private */
  _memoizedCoercedDefaultValue?: unknown;
}

/** @internal */
export function compileInputValue(type: GraphQLInputType): InputValueCoercer {
  return compileInputValueImpl(type, new Map());
}

function compileInputValueImpl(
  type: GraphQLInputType,
  cache: Map<GraphQLInputType, InputValueCoercer>,
): InputValueCoercer {
  const cachedCoercer = cache.get(type);
  if (cachedCoercer !== undefined) {
    return cachedCoercer;
  }

  const coercerRef: { current: InputValueCoercer | undefined } = {
    current: undefined,
  };
  const lazyCoercer: InputValueCoercer = (inputValue) => {
    invariant(coercerRef.current !== undefined);
    return coercerRef.current(inputValue);
  };
  cache.set(type, lazyCoercer);
  const coercer = compileInputValueUncached(type, cache);
  coercerRef.current = coercer;
  cache.set(type, coercer);
  return coercer;
}

function compileInputValueUncached(
  type: GraphQLInputType,
  cache: Map<GraphQLInputType, InputValueCoercer>,
): InputValueCoercer {
  if (isNonNullType(type)) {
    const innerCoercer = compileInputValueImpl(type.ofType, cache);
    return (inputValue) =>
      inputValue == null ? undefined : innerCoercer(inputValue);
  }

  if (isListType(type)) {
    return compileListInputValue(type.ofType, cache);
  }

  if (isInputObjectType(type)) {
    const fieldDefs = type.getFields();
    const fieldEntries: Array<InputObjectFieldDefinition> = [];
    for (const field of Object.values(fieldDefs)) {
      fieldEntries.push({
        name: field.name,
        defaultValue: compileDefaultInputValue(field),
        isRequired: isRequiredInputField(field),
      });
    }

    const fieldCoercers: ObjMap<InputValueCoercer> = Object.create(null);
    for (const field of Object.values(fieldDefs)) {
      fieldCoercers[field.name] = compileInputValueImpl(field.type, cache);
    }

    return (inputValue) => {
      if (inputValue == null) {
        return null;
      }

      if (!isObjectLike(inputValue) || Array.isArray(inputValue)) {
        return;
      }

      const coercedValue: ObjMap<unknown> = Object.create(null);
      let definedFieldCount = 0;
      for (const fieldName of Object.keys(inputValue)) {
        if (inputValue[fieldName] === undefined) {
          continue;
        }
        definedFieldCount++;
        if (fieldDefs[fieldName] === undefined) {
          return;
        }
      }

      for (const fieldEntry of fieldEntries) {
        const fieldValue = inputValue[fieldEntry.name];
        if (fieldValue === undefined) {
          if (fieldEntry.isRequired) {
            return;
          }
          const defaultValue = getCompiledDefaultInputValue(
            fieldEntry.defaultValue,
          );
          if (defaultValue !== undefined) {
            coercedValue[fieldEntry.name] = defaultValue;
          }
          continue;
        }

        const coercedField = fieldCoercers[fieldEntry.name](fieldValue);
        if (coercedField === undefined) {
          return;
        }
        coercedValue[fieldEntry.name] = coercedField;
      }

      if (type.isOneOf) {
        const keys = Object.keys(coercedValue);
        if (definedFieldCount !== 1 || keys.length !== 1) {
          return;
        }

        if (coercedValue[keys[0]] === null) {
          return;
        }
      }

      return coercedValue;
    };
  }

  const leafType = assertLeafType(type);
  return (inputValue) => {
    if (inputValue == null) {
      return null;
    }

    try {
      return leafType.coerceInputValue(inputValue);
    } catch (_error) {
      // Invalid: ignore error and intentionally return no value.
    }
  };
}

function compileListInputValue(
  itemType: GraphQLInputType,
  cache: Map<GraphQLInputType, InputValueCoercer>,
): InputValueCoercer {
  const itemCoercer = compileInputValueImpl(itemType, cache);
  return (inputValue) => {
    if (inputValue == null) {
      return null;
    }

    if (!isIterableObject(inputValue)) {
      const coercedItem = itemCoercer(inputValue);
      return coercedItem === undefined ? undefined : [coercedItem];
    }

    const coercedValue: Array<unknown> = [];
    for (const itemValue of inputValue) {
      const coercedItem = itemCoercer(itemValue);
      if (coercedItem === undefined) {
        return;
      }
      coercedValue.push(coercedItem);
    }
    return coercedValue;
  };
}

/** @internal */
export function compileInputLiteral(
  valueNode: ValueNode,
  type: GraphQLInputType,
): InputLiteralCoercer {
  if (valueNode.kind === Kind.VARIABLE) {
    return compileVariableInputLiteral(valueNode.name.value, type);
  }

  if (isNonNullType(type)) {
    if (valueNode.kind === Kind.NULL) {
      return invalidInputLiteral;
    }

    const innerCoercer = compileInputLiteral(valueNode, type.ofType);
    return (variableValues, fragmentVariableValues) =>
      innerCoercer(variableValues, fragmentVariableValues);
  }

  if (valueNode.kind === Kind.NULL) {
    return nullInputLiteral;
  }

  if (isListType(type)) {
    return compileListInputLiteral(valueNode, type.ofType);
  }

  if (isInputObjectType(type)) {
    return compileInputObjectLiteral(valueNode, type);
  }

  const leafType = assertLeafType(type);
  if (isStaticInputLiteral(valueNode)) {
    const coercedValue = coerceLeafInputLiteral(valueNode, leafType);
    return coercedValue === undefined
      ? invalidInputLiteral
      : () => coercedValue;
  }

  return (variableValues, fragmentVariableValues) =>
    coerceLeafInputLiteral(
      valueNode,
      leafType,
      variableValues,
      fragmentVariableValues,
    );
}

function compileVariableInputLiteral(
  variableName: string,
  type: GraphQLInputType,
): InputLiteralCoercer {
  return isNonNullType(type)
    ? (variableValues, fragmentVariableValues) => {
        const value =
          fragmentVariableValues == null
            ? variableValues?.coerced[variableName]
            : getCoercedVariableValue(
                variableName,
                variableValues,
                fragmentVariableValues,
              );
        return value ?? undefined;
      }
    : (variableValues, fragmentVariableValues) =>
        fragmentVariableValues == null
          ? variableValues?.coerced[variableName]
          : getCoercedVariableValue(
              variableName,
              variableValues,
              fragmentVariableValues,
            );
}

function compileListInputLiteral(
  valueNode: ValueNode,
  itemType: GraphQLInputType,
): InputLiteralCoercer {
  if (valueNode.kind !== Kind.LIST) {
    const itemCoercer = compileInputLiteral(valueNode, itemType);
    return (variableValues, fragmentVariableValues) => {
      const itemValue = itemCoercer(variableValues, fragmentVariableValues);
      return itemValue === undefined ? undefined : [itemValue];
    };
  }

  const itemNodes = valueNode.values;
  const itemCoercers = itemNodes.map((itemNode) =>
    compileInputLiteral(itemNode, itemType),
  );

  return (variableValues, fragmentVariableValues) => {
    const coercedValue = new Array<unknown>(itemCoercers.length);
    for (let i = 0; i < itemCoercers.length; ++i) {
      let itemValue = itemCoercers[i](variableValues, fragmentVariableValues);
      if (itemValue === undefined) {
        const itemNode = itemNodes[i];
        if (
          itemNode.kind === Kind.VARIABLE &&
          !isNonNullType(itemType) &&
          isMissingVariable(
            itemNode.name.value,
            variableValues,
            fragmentVariableValues,
          )
        ) {
          itemValue = null;
        } else {
          return;
        }
      }
      coercedValue[i] = itemValue;
    }
    return coercedValue;
  };
}

function compileInputObjectLiteral(
  valueNode: ValueNode,
  type: GraphQLInputObjectType,
): InputLiteralCoercer {
  if (valueNode.kind !== Kind.OBJECT) {
    return invalidInputLiteral;
  }

  const fieldDefs = type.getFields();
  const fieldNodesByName: ObjMap<ObjectFieldNode> = Object.create(null);
  let fieldNodeCount = 0;
  for (const fieldNode of valueNode.fields) {
    const fieldName = fieldNode.name.value;
    if (fieldDefs[fieldName] === undefined) {
      return invalidInputLiteral;
    }
    if (fieldNodesByName[fieldName] === undefined) {
      fieldNodeCount++;
    }
    fieldNodesByName[fieldName] = fieldNode;
  }

  const fieldEntries: Array<InputObjectLiteralField> = [];
  for (const field of Object.values(fieldDefs)) {
    const fieldNode = fieldNodesByName[field.name];
    if (fieldNode === undefined) {
      fieldEntries.push({
        kind: 'missing',
        name: field.name,
        defaultValue: compileDefaultInputValue(field),
        isRequired: isRequiredInputField(field),
      });
      continue;
    }

    fieldEntries.push({
      kind: 'present',
      name: field.name,
      valueNode: fieldNode.value,
      valueBuilder: compileInputLiteral(fieldNode.value, field.type),
      defaultValue: compileDefaultInputValue(field),
      isRequired: isRequiredInputField(field),
    });
  }

  return (variableValues, fragmentVariableValues) => {
    const coercedValue: ObjMap<unknown> = Object.create(null);
    for (const fieldEntry of fieldEntries) {
      if (
        fieldEntry.kind === 'missing' ||
        (fieldEntry.valueNode.kind === Kind.VARIABLE &&
          isMissingVariable(
            fieldEntry.valueNode.name.value,
            variableValues,
            fragmentVariableValues,
          ))
      ) {
        if (fieldEntry.isRequired) {
          return;
        }
        const defaultValue = getCompiledDefaultInputValue(
          fieldEntry.defaultValue,
        );
        if (defaultValue !== undefined) {
          coercedValue[fieldEntry.name] = defaultValue;
        }
        continue;
      }

      const fieldValue = fieldEntry.valueBuilder(
        variableValues,
        fragmentVariableValues,
      );
      if (fieldValue === undefined) {
        return;
      }
      coercedValue[fieldEntry.name] = fieldValue;
    }

    if (type.isOneOf) {
      const coercedKeys = Object.keys(coercedValue);
      if (fieldNodeCount !== 1 || coercedKeys.length !== 1) {
        return;
      }

      const fieldName = coercedKeys[0];
      const fieldNode = fieldNodesByName[fieldName];
      if (
        fieldNode.value.kind === Kind.NULL ||
        coercedValue[fieldName] === null
      ) {
        return;
      }
    }

    return coercedValue;
  };
}

function coerceLeafInputLiteral(
  valueNode: ValueNode,
  type: GraphQLLeafType,
  variableValues?: Maybe<VariableValues>,
  fragmentVariableValues?: Maybe<FragmentVariableValues>,
): unknown {
  try {
    return type.coerceInputLiteral
      ? type.coerceInputLiteral(
          replaceVariables(valueNode, variableValues, fragmentVariableValues),
        )
      : type.parseLiteral(valueNode, variableValues?.coerced);
  } catch (_error) {
    // Invalid: ignore error and intentionally return no value.
  }
}

function getCoercedVariableValue(
  variableName: string,
  variableValues: Maybe<VariableValues>,
  fragmentVariableValues: Maybe<FragmentVariableValues>,
): unknown {
  return getScopedVariableValues(
    variableName,
    variableValues,
    fragmentVariableValues,
  )?.coerced[variableName];
}

function getScopedVariableValues(
  variableName: string,
  variableValues: Maybe<VariableValues>,
  fragmentVariableValues: Maybe<FragmentVariableValues>,
): Maybe<VariableValues | FragmentVariableValues> {
  return fragmentVariableValues != null &&
    variableName in fragmentVariableValues.sources
    ? fragmentVariableValues
    : variableValues;
}

function isMissingVariable(
  variableName: string,
  variableValues: Maybe<VariableValues>,
  fragmentVariableValues: Maybe<FragmentVariableValues>,
): boolean {
  return fragmentVariableValues == null
    ? variableValues?.coerced[variableName] === undefined
    : getCoercedVariableValue(
        variableName,
        variableValues,
        fragmentVariableValues,
      ) === undefined;
}

function invalidInputLiteral(): undefined {
  return undefined;
}

function nullInputLiteral(): null {
  return null;
}

/** @internal */
export function isStaticInputLiteral(valueNode: ValueNode): boolean {
  switch (valueNode.kind) {
    case Kind.VARIABLE:
      return false;
    case Kind.LIST:
      return valueNode.values.every(isStaticInputLiteral);
    case Kind.OBJECT:
      return valueNode.fields.every((field) =>
        isStaticInputLiteral(field.value),
      );
    default:
      return true;
  }
}

/** @internal */
export function getDefaultInputValue(inputValue: InputValue): unknown {
  let coercedDefaultValue = inputValue._memoizedCoercedDefaultValue;
  if (coercedDefaultValue !== undefined) {
    return coercedDefaultValue;
  }

  const defaultInput = inputValue.default;
  if (defaultInput !== undefined) {
    coercedDefaultValue = defaultInput.literal
      ? compileInputLiteral(defaultInput.literal, inputValue.type)()
      : compileInputValue(inputValue.type)(defaultInput.value);
    invariant(
      coercedDefaultValue !== undefined,
      `Expected value of type "${inputValue.type}" to be valid, found: ${inspect(
        defaultInput.literal ?? defaultInput.value,
      )}.`,
    );
    inputValue._memoizedCoercedDefaultValue = coercedDefaultValue;
    return coercedDefaultValue;
  }

  const defaultValue = inputValue.defaultValue;
  if (defaultValue !== undefined) {
    inputValue._memoizedCoercedDefaultValue = defaultValue;
  }
  return defaultValue;
}

function compileDefaultInputValue(
  inputValue: InputValue,
): CompiledDefaultInputValue {
  try {
    return { value: getDefaultInputValue(inputValue), error: undefined };
  } catch (error) {
    return { value: undefined, error: ensureGraphQLError(error) };
  }
}

function getCompiledDefaultInputValue(
  defaultValue: CompiledDefaultInputValue,
): unknown {
  if (defaultValue.error !== undefined) {
    throw defaultValue.error;
  }
  return defaultValue.value;
}
