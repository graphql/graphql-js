import type { Maybe } from '../jsutils/Maybe';
import type { Path } from '../jsutils/Path';
import { addPath, pathToArray } from '../jsutils/Path';
import { didYouMean } from '../jsutils/didYouMean';
import { hasOwnProperty } from '../jsutils/hasOwnProperty';
import { inspect } from '../jsutils/inspect';
import { isIterableObject } from '../jsutils/isIterableObject';
import { isObjectLike } from '../jsutils/isObjectLike';
import { keyMap } from '../jsutils/keyMap';
import { suggestionList } from '../jsutils/suggestionList';

import { GraphQLError } from '../error/GraphQLError';

import type { ASTNode, ValueNode } from '../language/ast';
import { Kind } from '../language/kinds';
import { print } from '../language/printer';

import type { GraphQLInputType } from '../type/definition';
import {
  assertLeafType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isRequiredInputField,
} from '../type/definition';

import type { VariableValues } from '../execution/values';

import { replaceVariables } from './replaceVariables';

/**
 * Validate that the provided input value is allowed for this type, collecting
 * all errors via a callback function.
 */
export function validateInputValue(
  inputValue: unknown,
  type: GraphQLInputType,
  onError: (error: GraphQLError, path: ReadonlyArray<string | number>) => void,
  path?: Path,
): void {
  if (isNonNullType(type)) {
    if (inputValue === undefined) {
      reportInvalidValue(
        onError,
        `Expected a value of non-null type ${type} to be provided.`,
        path,
      );
      return;
    }
    if (inputValue === null) {
      reportInvalidValue(
        onError,
        `Expected value of non-null type ${type} not to be null.`,
        path,
      );
      return;
    }
    return validateInputValue(inputValue, type.ofType, onError, path);
  }

  if (inputValue == null) {
    return;
  }

  if (isListType(type)) {
    if (!isIterableObject(inputValue)) {
      // Lists accept a non-list value as a list of one.
      validateInputValue(inputValue, type.ofType, onError, path);
    } else {
      let index = 0;
      for (const itemValue of inputValue) {
        validateInputValue(
          itemValue,
          type.ofType,
          onError,
          addPath(path, index++, undefined),
        );
      }
    }
  } else if (isInputObjectType(type)) {
    if (!isObjectLike(inputValue)) {
      reportInvalidValue(
        onError,
        `Expected value of type ${type} to be an object, found: ${inspect(
          inputValue,
        )}.`,
        path,
      );
      return;
    }

    const fieldDefs = type.getFields();

    for (const field of Object.values(fieldDefs)) {
      const fieldValue = inputValue[field.name];
      if (fieldValue === undefined) {
        if (isRequiredInputField(field)) {
          reportInvalidValue(
            onError,
            `Expected value of type ${type} to include required field "${
              field.name
            }", found: ${inspect(inputValue)}.`,
            path,
          );
        }
      } else {
        validateInputValue(
          fieldValue,
          field.type,
          onError,
          addPath(path, field.name, type.name),
        );
      }
    }

    // Ensure every provided field is defined.
    for (const fieldName of Object.keys(inputValue)) {
      if (!hasOwnProperty(fieldDefs, fieldName)) {
        const suggestions = suggestionList(fieldName, Object.keys(fieldDefs));
        reportInvalidValue(
          onError,
          `Expected value of type ${type} not to include unknown field "${fieldName}"${
            suggestions.length > 0
              ? `.${didYouMean(suggestions)} Found`
              : ', found'
          }: ${inspect(inputValue)}.`,
          path,
        );
      }
    }
  } else {
    assertLeafType(type);

    let result;
    let caughtError;

    try {
      result = type.parseValue(inputValue);
    } catch (error) {
      if (error instanceof GraphQLError) {
        onError(error, pathToArray(path));
        return;
      }
      caughtError = error;
    }

    if (result === undefined) {
      reportInvalidValue(
        onError,
        `Expected value of type ${type}${
          caughtError
            ? `; ${caughtError.message || caughtError} Found`
            : ', found'
        }: ${inspect(inputValue)}.`,
        path,
        caughtError,
      );
    }
  }
}

function reportInvalidValue(
  onError: (error: GraphQLError, path: ReadonlyArray<string | number>) => void,
  message: string,
  path: Path | undefined,
  originalError?: GraphQLError | undefined,
): void {
  onError(
    new GraphQLError(message, null, null, null, null, originalError),
    pathToArray(path),
  );
}

/**
 * Validate that the provided input literal is allowed for this type, collecting
 * all errors via a callback function.
 *
 * If variable values are not provided, the literal is validated statically
 * (not assuming that those variables are missing runtime values).
 */
export function validateInputLiteral(
  valueNode: ValueNode,
  type: GraphQLInputType,
  variables: Maybe<VariableValues>,
  onError: (error: GraphQLError, path: ReadonlyArray<string | number>) => void,
  path?: Path,
): void {
  if (valueNode.kind === Kind.VARIABLE) {
    if (!variables) {
      // If no variable values are provided, this is being validated statically,
      // and cannot yet produce any validation errors for variables.
      return;
    }
    if (isMissingVariable(valueNode, variables)) {
      reportInvalidLiteral(
        onError,
        `Expected variable "$${valueNode.name.value}" provided to type ${type} to provide a runtime value.`,
        valueNode,
        path,
      );
    } else if (
      isNonNullType(type) &&
      variables.coerced[valueNode.name.value] === null
    ) {
      reportInvalidLiteral(
        onError,
        `Expected variable "$${valueNode.name.value}" provided to non-null type ${type} not to be null.`,
        valueNode,
        path,
      );
    }
    // Note: This does no further checking that this variable is correct.
    // This assumes this variable usage has already been validated.
    return;
  }

  if (isNonNullType(type)) {
    if (valueNode.kind === Kind.NULL) {
      reportInvalidLiteral(
        onError,
        `Expected value of non-null type ${type} not to be null.`,
        valueNode,
        path,
      );
      return;
    }
    return validateInputLiteral(
      valueNode,
      type.ofType,
      variables,
      onError,
      path,
    );
  }

  if (valueNode.kind === Kind.NULL) {
    return;
  }

  if (isListType(type)) {
    if (valueNode.kind !== Kind.LIST) {
      // Lists accept a non-list value as a list of one.
      validateInputLiteral(valueNode, type.ofType, variables, onError, path);
    } else {
      let index = 0;
      for (const itemNode of valueNode.values) {
        // A variable may be missing if the item type is nullable.
        if (
          variables &&
          isMissingVariable(itemNode, variables) &&
          !isNonNullType(type.ofType)
        ) {
          continue;
        }
        validateInputLiteral(
          itemNode,
          type.ofType,
          variables,
          onError,
          addPath(path, index++, undefined),
        );
      }
    }
  } else if (isInputObjectType(type)) {
    if (valueNode.kind !== Kind.OBJECT) {
      reportInvalidLiteral(
        onError,
        `Expected value of type ${type} to be an object, found: ${print(
          valueNode,
        )}.`,
        valueNode,
        path,
      );
      return;
    }

    const fieldDefs = type.getFields();
    const fieldNodes = keyMap(valueNode.fields, (field) => field.name.value);

    for (const field of Object.values(fieldDefs)) {
      const fieldNode = fieldNodes[field.name];
      if (fieldNode === undefined) {
        if (isRequiredInputField(field)) {
          reportInvalidLiteral(
            onError,
            `Expected value of type ${type} to include required field "${
              field.name
            }", found: ${print(valueNode)}.`,
            valueNode,
            path,
          );
        }
      } else {
        // A variable may be missing if the input field is not required.
        if (
          variables &&
          isMissingVariable(fieldNode.value, variables) &&
          !isRequiredInputField(field)
        ) {
          continue;
        }
        validateInputLiteral(
          fieldNode.value,
          field.type,
          variables,
          onError,
          addPath(path, field.name, type.name),
        );
      }
    }

    // Ensure every provided field is defined.
    for (const fieldNode of valueNode.fields) {
      const fieldName = fieldNode.name.value;
      if (!hasOwnProperty(fieldDefs, fieldName)) {
        const suggestions = suggestionList(fieldName, Object.keys(fieldDefs));
        reportInvalidLiteral(
          onError,
          `Expected value of type ${type} not to include unknown field "${fieldName}"${
            suggestions.length > 0
              ? `.${didYouMean(suggestions)} Found`
              : ', found'
          }: ${print(valueNode)}.`,
          fieldNode,
          path,
        );
      }
    }
  } else {
    assertLeafType(type);

    const constValueNode = replaceVariables(valueNode);

    let result;
    let caughtError;
    try {
      result = type.parseLiteral(constValueNode);
    } catch (error) {
      if (error instanceof GraphQLError) {
        onError(error, pathToArray(path));
        return;
      }
      caughtError = error;
    }

    if (result === undefined) {
      reportInvalidLiteral(
        onError,
        `Expected value of type ${type}${
          caughtError
            ? `; ${caughtError.message || caughtError} Found`
            : ', found'
        }: ${print(valueNode)}.`,
        valueNode,
        path,
        caughtError,
      );
    }
  }
}

// Returns true if the provided valueNode is a variable which is not defined
// in the set of variables.
function isMissingVariable(
  valueNode: ValueNode,
  variables: VariableValues,
): boolean {
  return (
    valueNode.kind === Kind.VARIABLE &&
    variables.coerced[valueNode.name.value] === undefined
  );
}

function reportInvalidLiteral(
  onError: (error: GraphQLError, path: ReadonlyArray<string | number>) => void,
  message: string,
  valueNode: ASTNode,
  path: Path | undefined,
  originalError?: GraphQLError | undefined,
): void {
  onError(
    new GraphQLError(message, valueNode, null, null, null, originalError),
    pathToArray(path),
  );
}
