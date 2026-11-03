/** @category Values */
import type { ConstValueNode } from "../language/ast.js";
import type { GraphQLInputType } from "../type/definition.js";
/**
 * Produces a GraphQL Value AST given a JavaScript value and a GraphQL type.
 *
 * Scalar types are converted by calling the `valueToLiteral` method on that
 * type, otherwise the default scalar `valueToLiteral` method is used, defined
 * below.
 *
 * Provided value is a non-coerced "input" value. This function does not
 * perform any coercion, however it does perform validation. Provided values
 * which are invalid for the given type will result in an `undefined` return
 * value.
 * @param value - JavaScript value to convert.
 * @param type - GraphQL input type to convert the value against.
 * @returns A GraphQL value AST, or undefined if the value is invalid.
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
 * import { valueToLiteral } from 'graphql/utilities';
 *
 * const ReviewInput = new GraphQLInputObjectType({
 *   name: 'ReviewInput',
 *   fields: {
 *     stars: { type: new GraphQLNonNull(GraphQLInt) },
 *     tags: { type: new GraphQLList(GraphQLString) },
 *   },
 * });
 *
 * const literal = valueToLiteral({ stars: 5, tags: ['featured'] }, ReviewInput);
 *
 * assert(literal);
 * print(literal); // => '{ stars: 5, tags: ["featured"] }'
 * valueToLiteral({ tags: ['missing stars'] }, ReviewInput); // => undefined
 * ```
 */
export declare function valueToLiteral(value: unknown, type: GraphQLInputType): ConstValueNode | undefined;
/**
 * The default implementation to convert scalar values to literals.
 *
 * | JavaScript Value  | GraphQL Value        |
 * | ----------------- | -------------------- |
 * | Object            | Input Object         |
 * | Array             | List                 |
 * | Boolean           | Boolean              |
 * | String            | String               |
 * | Number            | Int / Float          |
 * | BigInt            | Int                  |
 * | null / undefined  | Null                 |
 *
 * @internal
 */
export declare function defaultScalarValueToLiteral(value: unknown): ConstValueNode;
