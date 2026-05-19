/** @category Lexing */

/**
 * An exported enum describing the different kinds of tokens that the
 * lexer emits.
 */
enum TokenKind {
  /** Start-of-file token. */
  SOF = '<SOF>',
  /** End-of-file token. */
  EOF = '<EOF>',
  /** The `!` punctuation token. */
  BANG = '!',
  /** The `$` punctuation token. */
  DOLLAR = '$',
  /** The `&` punctuation token. */
  AMP = '&',
  /** The `(` punctuation token. */
  PAREN_L = '(',
  /** The `)` punctuation token. */
  PAREN_R = ')',
  /** The `.` punctuation token. */
  DOT = '.',
  /** The `...` spread punctuation token. */
  SPREAD = '...',
  /** The `:` punctuation token. */
  COLON = ':',
  /** The `=` punctuation token. */
  EQUALS = '=',
  /** The `@` punctuation token. */
  AT = '@',
  /** The `[` punctuation token. */
  BRACKET_L = '[',
  /** The `]` punctuation token. */
  BRACKET_R = ']',
  /** The `{` punctuation token. */
  BRACE_L = '{',
  /** The `|` punctuation token. */
  PIPE = '|',
  /** The `}` punctuation token. */
  BRACE_R = '}',
  /** A GraphQL name token or name AST node. */
  NAME = 'Name',
  /** An integer value token or AST node. */
  INT = 'Int',
  /** A floating-point value token or AST node. */
  FLOAT = 'Float',
  /** A string value token or AST node. */
  STRING = 'String',
  /** A block string value token. */
  BLOCK_STRING = 'BlockString',
  /** A comment token. */
  COMMENT = 'Comment',
}
export { TokenKind };

/**
 * Deprecated legacy alias for the enum type representing token kind values.
 * This alias will be removed in v17. In v17, `TokenKind` is exported as the
 * single public symbol for both the runtime object and the corresponding
 * TypeScript type.
 * @deprecated Will be removed in v17. In v17, use `TokenKind` as both the
 * runtime value and the type.
 */
export type TokenKindEnum = typeof TokenKind;
