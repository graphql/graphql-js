/**
 * An exported enum describing the different kinds of tokens that the
 * lexer emits.
 */
export const TokenKind = {
  SOF: '<SOF>' as const,
  EOF: '<EOF>' as const,
  BANG: '!' as const,
  DOLLAR: '$' as const,
  AMP: '&' as const,
  PAREN_L: '(' as const,
  PAREN_R: ')' as const,
  SPREAD: '...' as const,
  COLON: ':' as const,
  EQUALS: '=' as const,
  AT: '@' as const,
  BRACKET_L: '[' as const,
  BRACKET_R: ']' as const,
  BRACE_L: '{' as const,
  PIPE: '|' as const,
  BRACE_R: '}' as const,
  NAME: 'Name' as const,
  INT: 'Int' as const,
  FLOAT: 'Float' as const,
  STRING: 'String' as const,
  BLOCK_STRING: 'BlockString' as const,
  COMMENT: 'Comment' as const,
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type TokenKind = (typeof TokenKind)[keyof typeof TokenKind];
