/**
 * An exported enum describing the different kinds of tokens that the
 * lexer emits.
 */
export const TokenKind: Readonly<{
  readonly SOF: '<SOF>';
  readonly EOF: '<EOF>';
  readonly BANG: '!';
  readonly DOLLAR: '$';
  readonly AMP: '&';
  readonly PAREN_L: '(';
  readonly PAREN_R: ')';
  readonly SPREAD: '...';
  readonly COLON: ':';
  readonly EQUALS: '=';
  readonly AT: '@';
  readonly BRACKET_L: '[';
  readonly BRACKET_R: ']';
  readonly BRACE_L: '{';
  readonly PIPE: '|';
  readonly BRACE_R: '}';
  readonly NAME: 'Name';
  readonly INT: 'Int';
  readonly FLOAT: 'Float';
  readonly STRING: 'String';
  readonly BLOCK_STRING: 'BlockString';
  readonly COMMENT: 'Comment';
}>;
/**
 * The enum type representing the token kinds values.
 */
export type TokenKindEnum = typeof TokenKind[keyof typeof TokenKind];
