/** @category Values */
import type { Maybe } from "../jsutils/Maybe.mjs";
import { GraphQLError } from "../error/GraphQLError.mjs";
import type { ValueNode } from "../language/ast.mjs";
import type { GraphQLInputType } from "../type/definition.mjs";
import type { FragmentVariableValues } from "../execution/collectFields.mjs";
import type { VariableValues } from "../execution/values.mjs";
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
 * errors; // => [ { message: 'Int cannot represent non-integer value: "bad"', path: ['stars'] } ]
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
export declare function validateInputValue(inputValue: unknown, type: GraphQLInputType, onError: (error: GraphQLError, path: ReadonlyArray<string | number>) => void, hideSuggestions?: Maybe<boolean>): void;
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
 * errors; // => [ { message: 'Int cannot represent non-integer value: "bad"', path: ['stars'] } ]
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
 *   stars: 4,
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
export declare function validateInputLiteral(valueNode: ValueNode, type: GraphQLInputType, onError: (error: GraphQLError, path: ReadonlyArray<string | number>) => void, variables?: Maybe<VariableValues>, fragmentVariableValues?: Maybe<FragmentVariableValues>, hideSuggestions?: Maybe<boolean>): void;
