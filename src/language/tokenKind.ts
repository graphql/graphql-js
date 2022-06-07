/**
 * An exported enum describing the different kinds of tokens that the
 * lexer emits.
 */
export enum TokenKind {
  SOF = '<SOF>',
  EOF = '<EOF>',
  BANG = '!',
  QUESTION_MARK = '?',
  DOLLAR = '$',
  AMP = '&',
  PAREN_L = '(',
  PAREN_R = ')',
  SPREAD = '...',
  COLON = ':',
  EQUALS = '=',
  AT = '@',
  BRACKET_L = '[',
  BRACKET_R = ']',
  BRACE_L = '{',
  PIPE = '|',
  BRACE_R = '}',
  NAME = 'Name',
  INT = 'Int',
  FLOAT = 'Float',
  STRING = 'String',
  BLOCK_STRING = 'BlockString',
  COMMENT = 'Comment',
}
