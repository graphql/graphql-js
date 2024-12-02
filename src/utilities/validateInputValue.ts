import { didYouMean } from '../jsutils/didYouMean.js';
import { inspect } from '../jsutils/inspect.js';
import { isIterableObject } from '../jsutils/isIterableObject.js';
import { isObjectLike } from '../jsutils/isObjectLike.js';
import { keyMap } from '../jsutils/keyMap.js';
import type { Maybe } from '../jsutils/Maybe.js';
import type { Path } from '../jsutils/Path.js';
import { addPath, pathToArray } from '../jsutils/Path.js';
import { suggestionList } from '../jsutils/suggestionList.js';

import { GraphQLError } from '../error/GraphQLError.js';

import type { ASTNode, ValueNode, VariableNode } from '../language/ast.js';
import { Kind } from '../language/kinds.js';
import { print } from '../language/printer.js';

import type { GraphQLInputType } from '../type/definition.js';
import {
  assertLeafType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isRequiredInputField,
} from '../type/definition.js';

import type { VariableValues } from '../execution/values.js';

import { replaceVariables } from './replaceVariables.js';

/**
 * Validate that the provided input value is allowed for this type, collecting
 * all errors via a callback function.
 */
export function validateInputValue(
  inputValue: unknown,
  type: GraphQLInputType,
  onError: (error: GraphQLError, path: ReadonlyArray<string | number>) => void,
  hideSuggestions?: Maybe<boolean>,
): void {
  return validateInputValueImpl(
    inputValue,
    type,
    onError,
    hideSuggestions,
    undefined,
  );
}

function validateInputValueImpl(
  inputValue: unknown,
  type: GraphQLInputType,
  onError: (error: GraphQLError, path: ReadonlyArray<string | number>) => void,
  hideSuggestions: Maybe<boolean>,
  path: Path | undefined,
): void {
  if (isNonNullType(type)) {
    if (inputValue === undefined) {
      reportInvalidValue(
        onError,
        `Expected a value of non-null type "${type}" to be provided.`,
        path,
      );
      return;
    }
    if (inputValue === null) {
      reportInvalidValue(
        onError,
        `Expected value of non-null type "${type}" not to be null.`,
        path,
      );
      return;
    }
    return validateInputValueImpl(
      inputValue,
      type.ofType,
      onError,
      hideSuggestions,
      path,
    );
  }

  if (inputValue == null) {
    return;
  }

  if (isListType(type)) {
    if (!isIterableObject(inputValue)) {
      // Lists accept a non-list value as a list of one.
      validateInputValueImpl(
        inputValue,
        type.ofType,
        onError,
        hideSuggestions,
        path,
      );
    } else {
      let index = 0;
      for (const itemValue of inputValue) {
        validateInputValueImpl(
          itemValue,
          type.ofType,
          onError,
          hideSuggestions,
          addPath(path, index++, undefined),
        );
      }
    }
  } else if (isInputObjectType(type)) {
    if (!isObjectLike(inputValue)) {
      reportInvalidValue(
        onError,
        `Expected value of type "${type}" to be an object, found: ${inspect(
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
            `Expected value of type "${type}" to include required field "${
              field.name
            }", found: ${inspect(inputValue)}.`,
            path,
          );
        }
      } else {
        validateInputValueImpl(
          fieldValue,
          field.type,
          onError,
          hideSuggestions,
          addPath(path, field.name, type.name),
        );
      }
    }

    const fields = Object.keys(inputValue);
    // Ensure every provided field is defined.
    for (const fieldName of fields) {
      if (!Object.hasOwn(fieldDefs, fieldName)) {
        const suggestion = hideSuggestions
          ? ''
          : didYouMean(suggestionList(fieldName, Object.keys(fieldDefs)));
        reportInvalidValue(
          onError,
          `Expected value of type "${type}" not to include unknown field "${fieldName}"${
            suggestion ? `.${suggestion} Found` : ', found'
          }: ${inspect(inputValue)}.`,
          path,
        );
      }
    }

    if (type.isOneOf) {
      if (fields.length !== 1) {
        reportInvalidValue(
          onError,
          `Exactly one key must be specified for OneOf type "${type}".`,
          path,
        );
      }

      const field = fields[0];
      const value = inputValue[field];
      if (value === null) {
        reportInvalidValue(
          onError,
          `Field "${field}" for OneOf type "${type}" must be non-null.`,
          path,
        );
      }
    }
  } else {
    assertLeafType(type);

    let result;
    let caughtError;

    try {
      result = type.coerceInputValue(inputValue, hideSuggestions);
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
        `Expected value of type "${type}"${
          caughtError != null
            ? `, but encountered error "${caughtError.message != null && caughtError.message !== '' ? caughtError.message : caughtError}"; found`
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
  originalError?: GraphQLError,
): void {
  onError(new GraphQLError(message, { originalError }), pathToArray(path));
}

/**
 * Validate that the provided input literal is allowed for this type, collecting
 * all errors via a callback function.
 *
 * If variable values are not provided, the literal is validated statically
 * (not assuming that those variables are missing runtime values).
 */
// eslint-disable-next-line @typescript-eslint/max-params
export function validateInputLiteral(
  valueNode: ValueNode,
  type: GraphQLInputType,
  onError: (error: GraphQLError, path: ReadonlyArray<string | number>) => void,
  variables?: Maybe<VariableValues>,
  fragmentVariableValues?: Maybe<VariableValues>,
  hideSuggestions?: Maybe<boolean>,
): void {
  const context: ValidationContext = {
    static: !variables && !fragmentVariableValues,
    onError,
    variables,
    fragmentVariableValues,
  };
  return validateInputLiteralImpl(
    context,
    valueNode,
    type,
    hideSuggestions,
    undefined,
  );
}

interface ValidationContext {
  static: boolean;
  onError: (error: GraphQLError, path: ReadonlyArray<string | number>) => void;
  variables?: Maybe<VariableValues>;
  fragmentVariableValues?: Maybe<VariableValues>;
}

function validateInputLiteralImpl(
  context: ValidationContext,
  valueNode: ValueNode,
  type: GraphQLInputType,
  hideSuggestions: Maybe<boolean>,
  path: Path | undefined,
): void {
  if (valueNode.kind === Kind.VARIABLE) {
    if (context.static) {
      // If no variable values are provided, this is being validated statically,
      // and cannot yet produce any validation errors for variables.
      return;
    }
    const scopedVariableValues = getScopedVariableValues(context, valueNode);
    const value = scopedVariableValues?.coerced[valueNode.name.value];
    if (isNonNullType(type)) {
      if (value === undefined) {
        reportInvalidLiteral(
          context.onError,
          `Expected variable "$${valueNode.name.value}" provided to type "${type}" to provide a runtime value.`,
          valueNode,
          path,
        );
      } else if (value === null) {
        reportInvalidLiteral(
          context.onError,
          `Expected variable "$${valueNode.name.value}" provided to non-null type "${type}" not to be null.`,
          valueNode,
          path,
        );
      }
    }
    // Note: This does no further checking that this variable is correct.
    // This assumes this variable usage has already been validated.
    return;
  }

  if (isNonNullType(type)) {
    if (valueNode.kind === Kind.NULL) {
      reportInvalidLiteral(
        context.onError,
        `Expected value of non-null type "${type}" not to be null.`,
        valueNode,
        path,
      );
      return;
    }
    return validateInputLiteralImpl(
      context,
      valueNode,
      type.ofType,
      hideSuggestions,
      path,
    );
  }

  if (valueNode.kind === Kind.NULL) {
    return;
  }

  if (isListType(type)) {
    if (valueNode.kind !== Kind.LIST) {
      // Lists accept a non-list value as a list of one.
      validateInputLiteralImpl(
        context,
        valueNode,
        type.ofType,
        hideSuggestions,
        path,
      );
    } else {
      let index = 0;
      for (const itemNode of valueNode.values) {
        validateInputLiteralImpl(
          context,
          itemNode,
          type.ofType,
          hideSuggestions,
          addPath(path, index++, undefined),
        );
      }
    }
  } else if (isInputObjectType(type)) {
    if (valueNode.kind !== Kind.OBJECT) {
      reportInvalidLiteral(
        context.onError,
        `Expected value of type "${type}" to be an object, found: ${print(
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
            context.onError,
            `Expected value of type "${type}" to include required field "${
              field.name
            }", found: ${print(valueNode)}.`,
            valueNode,
            path,
          );
        }
      } else {
        const fieldValueNode = fieldNode.value;
        if (fieldValueNode.kind === Kind.VARIABLE && !context.static) {
          const scopedVariableValues = getScopedVariableValues(
            context,
            fieldValueNode,
          );
          const variableName = fieldValueNode.name.value;
          const value = scopedVariableValues?.coerced[variableName];
          if (type.isOneOf) {
            if (value === undefined) {
              reportInvalidLiteral(
                context.onError,
                `Expected variable "$${variableName}" provided to field "${field.name}" for OneOf Input Object type "${type}" to provide a runtime value.`,
                valueNode,
                path,
              );
            } else if (value === null) {
              reportInvalidLiteral(
                context.onError,
                `Expected variable "$${variableName}" provided to field "${field.name}" for OneOf Input Object type "${type}" not to be null.`,
                valueNode,
                path,
              );
            }
          } else if (value === undefined && !isRequiredInputField(field)) {
            continue;
          }
        }

        validateInputLiteralImpl(
          context,
          fieldValueNode,
          field.type,
          hideSuggestions,
          addPath(path, field.name, type.name),
        );
      }
    }

    const fields = valueNode.fields;
    // Ensure every provided field is defined.
    for (const fieldNode of fields) {
      const fieldName = fieldNode.name.value;
      if (!Object.hasOwn(fieldDefs, fieldName)) {
        const suggestion = hideSuggestions
          ? ''
          : didYouMean(suggestionList(fieldName, Object.keys(fieldDefs)));
        reportInvalidLiteral(
          context.onError,
          `Expected value of type "${type}" not to include unknown field "${fieldName}"${
            suggestion ? `.${suggestion} Found` : ', found'
          }: ${print(valueNode)}.`,
          fieldNode,
          path,
        );
      }
    }

    if (type.isOneOf) {
      const isNotExactlyOneField = fields.length !== 1;
      if (isNotExactlyOneField) {
        reportInvalidLiteral(
          context.onError,
          `OneOf Input Object "${type}" must specify exactly one key.`,
          valueNode,
          path,
        );
        return;
      }

      const fieldValueNode = fields[0].value;
      if (fieldValueNode.kind === Kind.NULL) {
        const fieldName = fields[0].name.value;
        reportInvalidLiteral(
          context.onError,
          `Field "${type}.${fieldName}" used for OneOf Input Object must be non-null.`,
          valueNode,
          addPath(path, fieldName, undefined),
        );
      }
    }
  } else {
    assertLeafType(type);

    let result;
    let caughtError;
    try {
      result = type.coerceInputLiteral
        ? type.coerceInputLiteral(replaceVariables(valueNode), hideSuggestions)
        : type.parseLiteral(valueNode, undefined, hideSuggestions);
    } catch (error) {
      if (error instanceof GraphQLError) {
        context.onError(error, pathToArray(path));
        return;
      }
      caughtError = error;
    }

    if (result === undefined) {
      reportInvalidLiteral(
        context.onError,
        `Expected value of type "${type}"${
          caughtError != null
            ? `, but encountered error "${caughtError.message != null && caughtError.message !== '' ? caughtError.message : caughtError}"; found`
            : ', found'
        }: ${print(valueNode)}.`,
        valueNode,
        path,
        caughtError,
      );
    }
  }
}

function getScopedVariableValues(
  context: ValidationContext,
  valueNode: VariableNode,
): Maybe<VariableValues> {
  const variableName = valueNode.name.value;
  const { fragmentVariableValues, variables } = context;
  return fragmentVariableValues?.sources[variableName]
    ? fragmentVariableValues
    : variables;
}

function reportInvalidLiteral(
  onError: (error: GraphQLError, path: ReadonlyArray<string | number>) => void,
  message: string,
  valueNode: ASTNode,
  path: Path | undefined,
  originalError?: GraphQLError,
): void {
  onError(
    new GraphQLError(message, { nodes: valueNode, originalError }),
    pathToArray(path),
  );
}
