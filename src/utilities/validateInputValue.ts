/** @category Values */

import { didYouMean } from '../jsutils/didYouMean.ts';
import { inspect } from '../jsutils/inspect.ts';
import { isIterableObject } from '../jsutils/isIterableObject.ts';
import { isObjectLike } from '../jsutils/isObjectLike.ts';
import type { Maybe } from '../jsutils/Maybe.ts';
import type { Path } from '../jsutils/Path.ts';
import { addPath, pathToArray } from '../jsutils/Path.ts';
import { suggestionList } from '../jsutils/suggestionList.ts';

import { ensureGraphQLError } from '../error/ensureGraphQLError.ts';
import { GraphQLError } from '../error/GraphQLError.ts';

import type { ValueNode } from '../language/ast.ts';

import type {
  GraphQLInputField,
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLLeafType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLNullableInputType,
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
import type { ConstInputSchema } from './validateInputLiteralWithConstInputSchema.ts';
import { validateInputLiteralWithConstInputSchema } from './validateInputLiteralWithConstInputSchema.ts';

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
  return validateInputLiteralWithConstInputSchema(
    valueNode,
    type,
    graphQLConstInputSchema,
    onError,
    variables,
    fragmentVariableValues,
    hideSuggestions,
  );
}

const graphQLConstInputSchema: ConstInputSchema<
  GraphQLInputType,
  GraphQLInputField,
  GraphQLNonNull<GraphQLNullableInputType>,
  GraphQLList<GraphQLInputType>,
  GraphQLInputObjectType,
  GraphQLLeafType
> = {
  getType(type) {
    const typeStr = String(type);
    if (isNonNullType(type)) {
      return { kind: 'nonNull', type, typeStr, nullableType: type.ofType };
    }
    if (isListType(type)) {
      return { kind: 'list', type, typeStr, itemType: type.ofType };
    }
    if (isInputObjectType(type)) {
      return {
        kind: 'inputObject',
        type,
        typeStr,
        fields: Object.values(type.getFields()),
        isOneOf: type.isOneOf,
      };
    }
    return { kind: 'leaf', type, typeStr };
  },
  getField(field) {
    return {
      name: field.name,
      type: field.type,
      isRequired: isRequiredInputField(field),
    };
  },
  coerceLeafLiteral(
    type,
    valueNode,
    variables,
    fragmentVariableValues,
    hideSuggestions,
  ) {
    const leafType = assertLeafType(type);
    return leafType.coerceInputLiteral
      ? leafType.coerceInputLiteral(
          replaceVariables(valueNode, variables, fragmentVariableValues),
          hideSuggestions,
        )
      : leafType.parseLiteral(valueNode, undefined, hideSuggestions);
  },
};

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
