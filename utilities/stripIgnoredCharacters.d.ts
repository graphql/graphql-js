/** @category AST Utilities */
import { Source } from "../language/source.js";
/**
 * Strips characters that are not significant to the validity or execution
 * of a GraphQL document:
 *   - UnicodeBOM
 *   - WhiteSpace
 *   - LineTerminator
 *   - Comment
 *   - Comma
 *   - BlockString indentation
 *
 * Note: It is required to have a delimiter character between neighboring
 * non-punctuator tokens and this function always uses single space as delimiter.
 *
 * It is guaranteed that both input and output documents if parsed would result
 * in the exact same AST except for nodes location.
 *
 * Warning: It is guaranteed that this function will always produce stable results.
 * However, it's not guaranteed that it will stay the same between different
 * releases due to bugfixes or changes in the GraphQL specification.
 * @param source - The GraphQL source text or source object.
 * @returns A semantically equivalent GraphQL source string without ignored characters.
 * @example Query source
 * ```graphql
 * query SomeQuery($foo: String!, $bar: String) {
 *   someField(foo: $foo, bar: $bar) {
 *     a
 *     b {
 *       c
 *       d
 *     }
 *   }
 * }
 * ```
 *
 * Becomes:
 *
 * ```graphql prettier-ignore
 * query SomeQuery($foo:String!$bar:String){someField(foo:$foo bar:$bar){a b{c d}}}
 * ```
 * @example SDL source
 * ```graphql
 * """
 * Type description
 * """
 * type Foo {
 *   """
 *   Field description
 *   """
 *   bar: String
 * }
 * ```
 *
 * Becomes:
 *
 * ```graphql prettier-ignore
 * """Type description""" type Foo{"""Field description""" bar:String}
 * ```
 * @example
 * ```ts
 * import { stripIgnoredCharacters } from 'graphql/utilities';
 *
 * const source = stripIgnoredCharacters('query Example { name }'); // => 'query Example{name}'
 * ```
 */
export declare function stripIgnoredCharacters(source: string | Source): string;
