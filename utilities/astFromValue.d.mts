/** @category Values */
import type { Maybe } from "../jsutils/Maybe.mjs";
import type { ConstValueNode } from "../language/ast.mjs";
import type { GraphQLInputType } from "../type/definition.mjs";
/**
 * Produces a GraphQL Value AST given a JavaScript object.
 * Function will match JavaScript/JSON values to GraphQL AST schema format
 * by using suggested GraphQLInputType.
 *
 * A GraphQL type must be provided, which will be used to interpret different
 * JavaScript values.
 *
 * This deprecated function will be removed in v18. Use `valueToLiteral()`
 * instead, and take care to operate on external values.
 *
 * | JSON Value    | GraphQL Value        |
 * | ------------- | -------------------- |
 * | Object        | Input Object         |
 * | Array         | List                 |
 * | Boolean       | Boolean              |
 * | String        | String / Enum Value  |
 * | Number        | Int / Float          |
 * | BigInt        | Int                  |
 * | Unknown       | Enum Value           |
 * | null          | NullValue            |
 * @param value - Runtime value to convert.
 * @param type - The GraphQL type to inspect.
 * @returns A GraphQL value AST for the provided JavaScript value, or null when no literal can represent it.
 * @example
 * ```ts
 * import assert from 'node:assert/strict';
 * import { print } from 'graphql/language';
 * import {
 *   GraphQLInputObjectType,
 *   GraphQLInt,
 *   GraphQLList,
 *   GraphQLNonNull,
 *   GraphQLString,
 * } from 'graphql/type';
 * import { astFromValue } from 'graphql/utilities';
 *
 * const ReviewInput = new GraphQLInputObjectType({
 *   name: 'ReviewInput',
 *   fields: {
 *     stars: { type: new GraphQLNonNull(GraphQLInt) },
 *     tags: { type: new GraphQLList(GraphQLString) },
 *   },
 * });
 *
 * const valueNode = astFromValue(
 *   { stars: 5, tags: ['featured', 'verified'] },
 *   ReviewInput,
 * );
 *
 * assert(valueNode);
 * print(valueNode); // => '{ stars: 5, tags: ["featured", "verified"] }'
 * astFromValue(undefined, GraphQLString); // => null
 * astFromValue(null, new GraphQLNonNull(GraphQLString)); // => null
 * ```
 * @deprecated use `valueToLiteral()` instead with care to operate on external values - `astFromValue()` will be removed in v18
 */
export declare function astFromValue(value: unknown, type: GraphQLInputType): Maybe<ConstValueNode>;
