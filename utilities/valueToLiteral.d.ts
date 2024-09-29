import type { ConstValueNode } from '../language/ast.js';
import type { GraphQLInputType } from '../type/definition.js';
/**
 * Produces a GraphQL Value AST given a JavaScript value and a GraphQL type.
 *
 * Scalar types are converted by calling the `valueToLiteral` method on that
 * type, otherwise the default scalar `valueToLiteral` method is used, defined
 * below.
 *
 * The provided value is an non-coerced "input" value. This function does not
 * perform any coercion, however it does perform validation. Provided values
 * which are invalid for the given type will result in an `undefined` return
 * value.
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
 * | null / undefined  | Null                 |
 *
 * @internal
 */
export declare function defaultScalarValueToLiteral(value: unknown): ConstValueNode;
