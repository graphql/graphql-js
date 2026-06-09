/** @category Values */

import { didYouMean } from '../jsutils/didYouMean.ts';
import { inspect } from '../jsutils/inspect.ts';
import { isIterableObject } from '../jsutils/isIterableObject.ts';
import { isObjectLike } from '../jsutils/isObjectLike.ts';
import { keyMap } from '../jsutils/keyMap.ts';
import type { Maybe } from '../jsutils/Maybe.ts';
import type { Path } from '../jsutils/Path.ts';
import { addPath, pathToArray } from '../jsutils/Path.ts';
import { suggestionList } from '../jsutils/suggestionList.ts';

import { ensureGraphQLError } from '../error/ensureGraphQLError.ts';
import { GraphQLError } from '../error/GraphQLError.ts';

import type { ASTNode, ValueNode, VariableNode } from '../language/ast.ts';
import { Kind } from '../language/kinds.ts';
import { print } from '../language/printer.ts';

import type { GraphQLInputType } from '../type/definition.ts';
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
 * Validate that the provided input value is allowed for this type, collecting
 * all errors via a callback function.
 * @param inputValue - JavaScript value to validate.
 * @param type - GraphQL input type to validate the value against.
 * @param onError - Callback invoked for each validation error and path.
 * @param hideSuggestions - Whether suggestion text should be omitted from errors.
 * @returns Nothing.
 * @example
 * ```ts
 * // Collect validation errors with their input paths.
 * import {
 *   GraphQLInputObjectType,
 *   GraphQLInt,
 *   GraphQLNonNull,
 * } from 'graphql/type';
 * import { validateInputValue } from 'graphql/utilities';
 *
 * const ReviewInput = new GraphQLInputObjectType({
 *   name: 'ReviewInput',
 *   fields: {
 *     stars: { type: new GraphQLNonNull(GraphQLInt) },
 *   },
 * });
 * const errors = [];
 *
 * validateInputValue({ stars: 'bad' }, ReviewInput, (error, path) => {
 *   errors.push({ message: error.message, path });
 * });
 *
 * errors; // => [ { message: 'Expected value of type "Int", found: "bad".', path: ['stars'] } ]
 * ```
 * @example
 * ```ts
 * // This variant hides suggestion text for unknown input fields.
 * import { GraphQLInputObjectType, GraphQLString } from 'graphql/type';
 * import { validateInputValue } from 'graphql/utilities';
 *
 * const ReviewInput = new GraphQLInputObjectType({
 *   name: 'ReviewInput',
 *   fields: {
 *     comment: { type: GraphQLString },
 *   },
 * });
 * const errors = [];
 *
 * validateInputValue(
 *   { rating: 'extra field' },
 *   ReviewInput,
 *   (error) => {
 *     errors.push(error.message);
 *   },
 *   true,
 * );
 *
 * errors; // => ['Expected value of type "ReviewInput" not to include unknown field "rating", found: { rating: "extra field" }.']
 * ```
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
    if (!isObjectLike(inputValue) || Array.isArray(inputValue)) {
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

    const fields: Array<string> = [];
    // Ensure every provided field is defined.
    for (const fieldName of Object.keys(inputValue)) {
      if (inputValue[fieldName] === undefined) {
        continue;
      }
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
        continue;
      }
      fields.push(fieldName);
    }

    if (type.isOneOf) {
      if (fields.length !== 1) {
        reportInvalidValue(
          onError,
          getOneOfInputObjectErrorMessage(type),
          path,
        );
      }

      const field = fields[0];
      const value = inputValue[field];
      if (value === null) {
        reportInvalidValue(
          onError,
          getOneOfInputObjectErrorMessage(type),
          addPath(path, field, type.name),
        );
      }
    }
  } else {
    assertLeafType(type);

    let result;
    let caughtError: unknown;

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
            ? `, but encountered error "${getCaughtErrorMessage(caughtError)}"; found`
            : ', found'
        }: ${inspect(inputValue)}.`,
        path,
        ensureGraphQLError(caughtError),
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
 * @param valueNode - GraphQL value AST node to validate.
 * @param type - GraphQL input type to validate the literal against.
 * @param onError - Callback invoked for each validation error and path.
 * @param variables - Operation variable values returned by getVariableValues.
 * @param fragmentVariableValues - Fragment variable values for the current fragment scope.
 * @param hideSuggestions - Whether suggestion text should be omitted from errors.
 * @returns Nothing.
 * @example
 * ```ts
 * // Validate literal input values and collect literal paths.
 * import { parseValue } from 'graphql/language';
 * import {
 *   GraphQLInputObjectType,
 *   GraphQLInt,
 *   GraphQLNonNull,
 * } from 'graphql/type';
 * import { validateInputLiteral } from 'graphql/utilities';
 *
 * const ReviewInput = new GraphQLInputObjectType({
 *   name: 'ReviewInput',
 *   fields: {
 *     stars: { type: new GraphQLNonNull(GraphQLInt) },
 *   },
 * });
 * const errors = [];
 *
 * validateInputLiteral(
 *   parseValue('{ stars: "bad" }'),
 *   ReviewInput,
 *   (error, path) => {
 *     errors.push({ message: error.message, path });
 *   },
 * );
 *
 * errors; // => [ { message: 'Expected value of type "Int", found: "bad".', path: ['stars'] } ]
 * ```
 * @example
 * ```ts
 * // This variant resolves variable references using VariableValues from getVariableValues().
 * import assert from 'node:assert';
 * import { parse, parseValue } from 'graphql/language';
 * import { GraphQLInt } from 'graphql/type';
 * import { getVariableValues } from 'graphql/execution';
 * import { buildSchema, validateInputLiteral } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     review(stars: Int): String
 *   }
 * `);
 * const document = parse('query ($stars: Int = 5) { review(stars: $stars) }');
 * const operation = document.definitions[0];
 * const result = getVariableValues(schema, operation.variableDefinitions, {
 *   stars: '4',
 * });
 *
 * assert('variableValues' in result);
 *
 * const errors = [];
 * validateInputLiteral(
 *   parseValue('$stars'),
 *   GraphQLInt,
 *   (error) => errors.push(error.message),
 *   result.variableValues,
 *   undefined,
 *   true,
 * );
 *
 * errors; // => []
 * ```
 */
// eslint-disable-next-line max-params
export function validateInputLiteral(
  valueNode: ValueNode,
  type: GraphQLInputType,
  onError: (error: GraphQLError, path: ReadonlyArray<string | number>) => void,
  variables?: Maybe<VariableValues>,
  fragmentVariableValues?: Maybe<FragmentVariableValues>,
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
  fragmentVariableValues?: Maybe<FragmentVariableValues>;
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
    const knownFields: Array<(typeof fields)[number]> = [];
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
      } else {
        knownFields.push(fieldNode);
      }
    }

    if (type.isOneOf) {
      const isNotExactlyOneField = knownFields.length !== 1;
      if (isNotExactlyOneField) {
        reportInvalidLiteral(
          context.onError,
          getOneOfInputObjectErrorMessage(type),
          valueNode,
          path,
        );
        return;
      }

      const fieldValueNode = knownFields[0].value;
      if (fieldValueNode.kind === Kind.NULL) {
        const fieldName = knownFields[0].name.value;
        reportInvalidLiteral(
          context.onError,
          getOneOfInputObjectErrorMessage(type),
          valueNode,
          addPath(path, fieldName, undefined),
        );
      }
    }
  } else {
    assertLeafType(type);

    let result;
    let caughtError: unknown;
    try {
      result = type.coerceInputLiteral
        ? type.coerceInputLiteral(
            replaceVariables(
              valueNode,
              context.variables,
              context.fragmentVariableValues,
            ),
            hideSuggestions,
          )
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
            ? `, but encountered error "${getCaughtErrorMessage(caughtError)}"; found`
            : ', found'
        }: ${print(valueNode)}.`,
        valueNode,
        path,
        ensureGraphQLError(caughtError),
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
    new GraphQLError(message, {
      nodes: valueNode,
      originalError,
    }),
    pathToArray(path),
  );
}

function getCaughtErrorMessage(caughtError: unknown): string {
  if (isObjectLike(caughtError)) {
    const message = caughtError.message;
    if (typeof message === 'string' && message !== '') {
      return message;
    }
  }

  return String(caughtError);
}

function getOneOfInputObjectErrorMessage(type: GraphQLInputType): string {
  return `Within OneOf Input Object type "${type}", exactly one field must be specified, and the value for that field must be non-null.`;
}
