'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.stripIgnoredCharacters = void 0;
const blockString_js_1 = require('../language/blockString.js');
const lexer_js_1 = require('../language/lexer.js');
const source_js_1 = require('../language/source.js');
const tokenKind_js_1 = require('../language/tokenKind.js');
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
 *
 * Query example:
 *
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
 * ```graphql
 * query SomeQuery($foo:String!$bar:String){someField(foo:$foo bar:$bar){a b{c d}}}
 * ```
 *
 * SDL example:
 *
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
 * ```graphql
 * """Type description""" type Foo{"""Field description""" bar:String}
 * ```
 */
function stripIgnoredCharacters(source) {
  const sourceObj = (0, source_js_1.isSource)(source)
    ? source
    : new source_js_1.Source(source);
  const body = sourceObj.body;
  const lexer = new lexer_js_1.Lexer(sourceObj);
  let strippedBody = '';
  let wasLastAddedTokenNonPunctuator = false;
  while (lexer.advance().kind !== tokenKind_js_1.TokenKind.EOF) {
    const currentToken = lexer.token;
    const tokenKind = currentToken.kind;
    /**
     * Every two non-punctuator tokens should have space between them.
     * Also prevent case of non-punctuator token following by spread resulting
     * in invalid token (e.g. `1...` is invalid Float token).
     */
    const isNonPunctuator = !(0, lexer_js_1.isPunctuatorTokenKind)(
      currentToken.kind,
    );
    if (wasLastAddedTokenNonPunctuator) {
      if (
        isNonPunctuator ||
        currentToken.kind === tokenKind_js_1.TokenKind.SPREAD
      ) {
        strippedBody += ' ';
      }
    }
    const tokenBody = body.slice(currentToken.start, currentToken.end);
    if (tokenKind === tokenKind_js_1.TokenKind.BLOCK_STRING) {
      strippedBody += (0, blockString_js_1.printBlockString)(
        currentToken.value,
        { minimize: true },
      );
    } else {
      strippedBody += tokenBody;
    }
    wasLastAddedTokenNonPunctuator = isNonPunctuator;
  }
  return strippedBody;
}
exports.stripIgnoredCharacters = stripIgnoredCharacters;
