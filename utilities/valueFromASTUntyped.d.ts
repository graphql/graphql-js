/** @category Values */
import type { Maybe } from "../jsutils/Maybe.js";
import type { ObjMap } from "../jsutils/ObjMap.js";
import type { ValueNode } from "../language/ast.js";
/**
 * Produces a JavaScript value given a GraphQL Value AST.
 *
 * Because no GraphQL type is provided, the returned JavaScript value reflects
 * the provided GraphQL value AST.
 *
 * | GraphQL Value        | JavaScript Value |
 * | -------------------- | ---------------- |
 * | Input Object         | Object           |
 * | List                 | Array            |
 * | Boolean              | Boolean          |
 * | String / Enum        | String           |
 * | Int / Float          | Number           |
 * | Null                 | null             |
 * @param valueNode - GraphQL value AST node to convert.
 * @param variables - Optional runtime variable values keyed by variable name.
 * @returns JavaScript value represented by the GraphQL value AST.
 * @example
 * ```ts
 * import { parseValue } from 'graphql/language';
 * import { valueFromASTUntyped } from 'graphql/utilities';
 *
 * const value = valueFromASTUntyped(parseValue('[1, 2, 3]')); // => [1, 2, 3]
 * valueFromASTUntyped(parseValue('$name'), { name: 'Ada' }); // => 'Ada'
 * ```
 */
export declare function valueFromASTUntyped(valueNode: ValueNode, variables?: Maybe<ObjMap<unknown>>): unknown;
