/** @category Values */
import type { Maybe } from "../jsutils/Maybe.js";
import type { ValueNode } from "../language/ast.js";
import type { GraphQLDefaultInput, GraphQLInputType } from "../type/definition.js";
import type { FragmentVariableValues } from "../execution/collectFields.js";
import type { VariableValues } from "../execution/values.js";
/**
 * Coerces a JavaScript value given a GraphQL Input Type.
 *
 * Returns `undefined` when the value could not be validly coerced according to
 * the provided type. Use `validateInputValue` when coercion diagnostics
 * are needed.
 * @param inputValue - JavaScript value to coerce.
 * @param type - GraphQL input type to coerce the value against.
 * @returns Coerced value, or undefined if coercion fails.
 * @example
 * ```ts
 * // Coerce runtime input values, returning undefined when coercion fails.
 * import {
 *   GraphQLInputObjectType,
 *   GraphQLInt,
 *   GraphQLList,
 *   GraphQLNonNull,
 *   GraphQLString,
 * } from 'graphql/type';
 * import { coerceInputValue } from 'graphql/utilities';
 *
 * const ReviewInput = new GraphQLInputObjectType({
 *   name: 'ReviewInput',
 *   fields: {
 *     stars: { type: new GraphQLNonNull(GraphQLInt) },
 *     tags: { type: new GraphQLList(GraphQLString) },
 *   },
 * });
 *
 * coerceInputValue({ stars: 5, tags: ['featured'] }, ReviewInput); // => { stars: 5, tags: ['featured'] }
 * coerceInputValue({ stars: 'bad' }, ReviewInput); // => undefined
 * ```
 */
export declare function coerceInputValue(inputValue: unknown, type: GraphQLInputType): unknown;
/**
 * Produces a coerced "internal" JavaScript value given a GraphQL Value AST.
 *
 * Returns `undefined` when the value could not be validly coerced according to
 * the provided type.
 * @param valueNode - GraphQL value AST node to coerce.
 * @param type - GraphQL input type to coerce the literal against.
 * @param variableValues - Operation variable values returned by getVariableValues.
 * @param fragmentVariableValues - Fragment variable values for the current fragment scope.
 * @returns Coerced value, or undefined if coercion fails.
 * @example
 * ```ts
 * // Coerce literal input values without variables.
 * import { parseValue } from 'graphql/language';
 * import {
 *   GraphQLInputObjectType,
 *   GraphQLInt,
 *   GraphQLNonNull,
 *   GraphQLString,
 * } from 'graphql/type';
 * import { coerceInputLiteral } from 'graphql/utilities';
 *
 * const ReviewInput = new GraphQLInputObjectType({
 *   name: 'ReviewInput',
 *   fields: {
 *     stars: { type: new GraphQLNonNull(GraphQLInt) },
 *     comment: { type: GraphQLString },
 *   },
 * });
 *
 * coerceInputLiteral(
 *   parseValue('{ stars: 5, comment: "Loved it" }'),
 *   ReviewInput,
 * ); // => { stars: 5, comment: 'Loved it' }
 * coerceInputLiteral(parseValue('{ comment: "Missing" }'), ReviewInput); // => undefined
 * ```
 * @example
 * ```ts
 * // This variant resolves variable references using VariableValues from getVariableValues().
 * import assert from 'node:assert';
 * import { parse, parseValue } from 'graphql/language';
 * import { GraphQLInt } from 'graphql/type';
 * import { getVariableValues } from 'graphql/execution';
 * import { buildSchema, coerceInputLiteral } from 'graphql/utilities';
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
 * coerceInputLiteral(parseValue('$stars'), GraphQLInt, result.variableValues); // => 4
 * ```
 */
export declare function coerceInputLiteral(valueNode: ValueNode, type: GraphQLInputType, variableValues?: Maybe<VariableValues>, fragmentVariableValues?: Maybe<FragmentVariableValues>): unknown;
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
export declare function coerceDefaultValue(inputValue: InputValue): unknown;
export {};
