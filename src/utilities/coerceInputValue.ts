import { didYouMean } from '../jsutils/didYouMean.js';
import { inspect } from '../jsutils/inspect.js';
import { invariant } from '../jsutils/invariant.js';
import { isIterableObject } from '../jsutils/isIterableObject.js';
import { isObjectLike } from '../jsutils/isObjectLike.js';
import type { Maybe } from '../jsutils/Maybe.js';
import type { Path } from '../jsutils/Path.js';
import { addPath, pathToArray } from '../jsutils/Path.js';
import { printPathArray } from '../jsutils/printPathArray.js';
import { suggestionList } from '../jsutils/suggestionList.js';

import { GraphQLError } from '../error/GraphQLError.js';

import type { ValueNode, VariableNode } from '../language/ast.js';
import { Kind } from '../language/kinds.js';

import type {
  GraphQLDefaultValueUsage,
  GraphQLInputType,
} from '../type/definition.js';
import {
  assertLeafType,
  isInputObjectType,
  isLeafType,
  isListType,
  isNonNullType,
  isRequiredInputField,
} from '../type/definition.js';

import type { VariableValues } from '../execution/values.js';

import { replaceVariables } from './replaceVariables.js';

type OnErrorCB = (
  path: ReadonlyArray<string | number>,
  invalidValue: unknown,
  error: GraphQLError,
) => void;

/**
 * Coerces a JavaScript value given a GraphQL Input Type.
 */
export function coerceInputValue(
  inputValue: unknown,
  type: GraphQLInputType,
  maskSuggestions?: boolean,
  onError: OnErrorCB = defaultOnError,
): unknown {
  return coerceInputValueImpl(
    inputValue,
    type,
    onError,
    undefined,
    maskSuggestions ?? false,
  );
}

function defaultOnError(
  path: ReadonlyArray<string | number>,
  invalidValue: unknown,
  error: GraphQLError,
): void {
  let errorPrefix = 'Invalid value ' + inspect(invalidValue);
  if (path.length > 0) {
    errorPrefix += ` at "value${printPathArray(path)}"`;
  }
  error.message = errorPrefix + ': ' + error.message;
  throw error;
}

function coerceInputValueImpl(
  inputValue: unknown,
  type: GraphQLInputType,
  onError: OnErrorCB,
  path: Path | undefined,
  maskSuggestions: boolean,
): unknown {
  if (isNonNullType(type)) {
    if (inputValue != null) {
      return coerceInputValueImpl(
        inputValue,
        type.ofType,
        onError,
        path,
        maskSuggestions,
      );
    }
    onError(
      pathToArray(path),
      inputValue,
      new GraphQLError(
        `Expected non-nullable type "${inspect(type)}" not to be null.`,
      ),
    );
    return;
  }

  if (inputValue == null) {
    // Explicitly return the value null.
    return null;
  }

  if (isListType(type)) {
    const itemType = type.ofType;
    if (isIterableObject(inputValue)) {
      return Array.from(inputValue, (itemValue, index) => {
        const itemPath = addPath(path, index, undefined);
        return coerceInputValueImpl(
          itemValue,
          itemType,
          onError,
          itemPath,
          maskSuggestions,
        );
      });
    }
    // Lists accept a non-list value as a list of one.
    return [
      coerceInputValueImpl(
        inputValue,
        itemType,
        onError,
        path,
        maskSuggestions,
      ),
    ];
  }

  if (isInputObjectType(type)) {
    if (!isObjectLike(inputValue)) {
      onError(
        pathToArray(path),
        inputValue,
        new GraphQLError(`Expected type "${type}" to be an object.`),
      );
      return;
    }

    const coercedValue: any = {};
    const fieldDefs = type.getFields();

    for (const field of Object.values(fieldDefs)) {
      const fieldValue = inputValue[field.name];

      if (fieldValue === undefined) {
        if (field.defaultValue) {
          coercedValue[field.name] = coerceDefaultValue(
            field.defaultValue,
            field.type,
            maskSuggestions,
          );
        } else if (isNonNullType(field.type)) {
          const typeStr = inspect(field.type);
          onError(
            pathToArray(path),
            inputValue,
            new GraphQLError(
              `Field "${type}.${field.name}" of required type "${typeStr}" was not provided.`,
            ),
          );
        }
        continue;
      }

      coercedValue[field.name] = coerceInputValueImpl(
        fieldValue,
        field.type,
        onError,
        addPath(path, field.name, type.name),
        maskSuggestions,
      );
    }

    // Ensure every provided field is defined.
    for (const fieldName of Object.keys(inputValue)) {
      if (fieldDefs[fieldName] == null) {
        const suggestions = suggestionList(
          fieldName,
          Object.keys(type.getFields()),
        );
        onError(
          pathToArray(path),
          inputValue,
          new GraphQLError(
            `Field "${fieldName}" is not defined by type "${type}".` +
              (maskSuggestions ? '' : didYouMean(suggestions)),
          ),
        );
      }
    }

    if (type.isOneOf) {
      const keys = Object.keys(coercedValue);
      if (keys.length !== 1) {
        onError(
          pathToArray(path),
          inputValue,
          new GraphQLError(
            `Exactly one key must be specified for OneOf type "${type}".`,
          ),
        );
      }

      const key = keys[0];
      const value = coercedValue[key];
      if (value === null) {
        onError(
          pathToArray(path).concat(key),
          value,
          new GraphQLError(`Field "${key}" must be non-null.`),
        );
      }
    }

    return coercedValue;
  }

  if (isLeafType(type)) {
    let parseResult;

    // Scalars and Enums determine if an input value is valid via parseValue(),
    // which can throw to indicate failure. If it throws, maintain a reference
    // to the original error.
    try {
      parseResult = type.parseValue(inputValue, maskSuggestions);
    } catch (error) {
      if (error instanceof GraphQLError) {
        onError(pathToArray(path), inputValue, error);
      } else {
        onError(
          pathToArray(path),
          inputValue,
          new GraphQLError(`Expected type "${type}". ` + error.message, {
            originalError: error,
          }),
        );
      }
      return;
    }
    if (parseResult === undefined) {
      onError(
        pathToArray(path),
        inputValue,
        new GraphQLError(`Expected type "${type}".`),
      );
    }
    return parseResult;
  }
  /* c8 ignore next 3 */
  // Not reachable, all possible types have been considered.
  invariant(false, 'Unexpected input type: ' + inspect(type));
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
  maskSuggestions?: boolean,
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
      maskSuggestions,
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
        maskSuggestions,
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
        maskSuggestions,
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

    const coercedValue: { [field: string]: unknown } = {};
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
            maskSuggestions,
          );
        }
      } else {
        const fieldValue = coerceInputLiteral(
          fieldNode.value,
          field.type,
          maskSuggestions,
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
    return leafType.parseConstLiteral
      ? leafType.parseConstLiteral(
          replaceVariables(valueNode, variableValues, fragmentVariableValues),
          maskSuggestions,
        )
      : leafType.parseLiteral(
          valueNode,
          variableValues?.coerced,
          maskSuggestions,
        );
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
  maskSuggestions?: boolean,
): unknown {
  // Memoize the result of coercing the default value in a hidden field.
  let coercedValue = (defaultValue as any)._memoizedCoercedValue;
  if (coercedValue === undefined) {
    coercedValue = defaultValue.literal
      ? coerceInputLiteral(defaultValue.literal, type, maskSuggestions)
      : defaultValue.value;
    (defaultValue as any)._memoizedCoercedValue = coercedValue;
  }
  return coercedValue;
}
