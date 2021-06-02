import { syntaxError } from '../error/syntaxError';

import type { Source } from './source';
import type { TokenKindEnum } from './tokenKind';
import { Token } from './ast';
import { TokenKind } from './tokenKind';
import { dedentBlockStringValue } from './blockString';

/**
 * Given a Source object, creates a Lexer for that source.
 * A Lexer is a stateful stream generator in that every time
 * it is advanced, it returns the next token in the Source. Assuming the
 * source lexes, the final Token emitted by the lexer will be of kind
 * EOF, after which the lexer will repeatedly return the same EOF token
 * whenever called.
 */
export class Lexer {
  source: Source;

  /**
   * The previously focused non-ignored token.
   */
  lastToken: Token;

  /**
   * The currently focused non-ignored token.
   */
  token: Token;

  /**
   * The (1-indexed) line containing the current token.
   */
  line: number;

  /**
   * The character offset at which the current line begins.
   */
  lineStart: number;

  constructor(source: Source) {
    const startOfFileToken = new Token(TokenKind.SOF, 0, 0, 0, 0);

    this.source = source;
    this.lastToken = startOfFileToken;
    this.token = startOfFileToken;
    this.line = 1;
    this.lineStart = 0;
  }

  /**
   * Advances the token stream to the next non-ignored token.
   */
  advance(): Token {
    this.lastToken = this.token;
    const token = (this.token = this.lookahead());
    return token;
  }

  /**
   * Looks ahead and returns the next non-ignored token, but does not change
   * the state of Lexer.
   */
  lookahead(): Token {
    let token = this.token;
    if (token.kind !== TokenKind.EOF) {
      do {
        if (token.next) {
          token = token.next;
        } else {
          // Read the next token and form a link in the token linked-list.
          const nextToken = readNextToken(this, token.end);
          // @ts-expect-error next is only mutable during parsing.
          token.next = nextToken;
          // @ts-expect-error prev is only mutable during parsing.
          nextToken.prev = token;
          token = nextToken;
        }
      } while (token.kind === TokenKind.COMMENT);
    }
    return token;
  }
}

/**
 * @internal
 */
export function isPunctuatorTokenKind(kind: TokenKindEnum): boolean {
  return (
    kind === TokenKind.BANG ||
    kind === TokenKind.DOLLAR ||
    kind === TokenKind.AMP ||
    kind === TokenKind.PAREN_L ||
    kind === TokenKind.PAREN_R ||
    kind === TokenKind.SPREAD ||
    kind === TokenKind.COLON ||
    kind === TokenKind.EQUALS ||
    kind === TokenKind.AT ||
    kind === TokenKind.BRACKET_L ||
    kind === TokenKind.BRACKET_R ||
    kind === TokenKind.BRACE_L ||
    kind === TokenKind.PIPE ||
    kind === TokenKind.BRACE_R
  );
}

function printCharCode(code: number): string {
  return (
    // NaN/undefined represents access beyond the end of the file.
    isNaN(code)
      ? TokenKind.EOF
      : // Trust JSON for ASCII.
      code < 0x007f
      ? JSON.stringify(String.fromCharCode(code))
      : // Otherwise print the escaped form.
        `"\\u${('00' + code.toString(16).toUpperCase()).slice(-4)}"`
  );
}

/**
 * Create a token with line and column location information.
 */
function createToken(
  lexer: Lexer,
  kind: TokenKindEnum,
  start: number,
  end: number,
  value?: string,
): Token {
  const line = lexer.line;
  const col = 1 + start - lexer.lineStart;
  return new Token(kind, start, end, line, col, value);
}

/**
 * Gets the next token from the source starting at the given position.
 *
 * This skips over whitespace until it finds the next lexable token, then lexes
 * punctuators immediately or calls the appropriate helper function for more
 * complicated tokens.
 */
function readNextToken(lexer: Lexer, start: number): Token {
  const body = lexer.source.body;
  const bodyLength = body.length;

  let position = start;
  while (position < bodyLength) {
    const code = body.charCodeAt(position);

    // SourceCharacter
    switch (code) {
      case 0xfeff: // <BOM>
      case 0x0009: //  \t
      case 0x0020: // <space>
      case 0x002c: // ,
        ++position;
        continue;
      case 0x000a: // \n
        ++position;
        ++lexer.line;
        lexer.lineStart = position;
        continue;
      case 0x000d: // \r
        if (body.charCodeAt(position + 1) === 0x000a) {
          position += 2;
        } else {
          ++position;
        }
        ++lexer.line;
        lexer.lineStart = position;
        continue;
      case 0x0021: // !
        return createToken(lexer, TokenKind.BANG, position, position + 1);
      case 0x0023: // #
        return readComment(lexer, position);
      case 0x0024: // $
        return createToken(lexer, TokenKind.DOLLAR, position, position + 1);
      case 0x0026: // &
        return createToken(lexer, TokenKind.AMP, position, position + 1);
      case 0x0028: // (
        return createToken(lexer, TokenKind.PAREN_L, position, position + 1);
      case 0x0029: // )
        return createToken(lexer, TokenKind.PAREN_R, position, position + 1);
      case 0x002e: // .
        if (
          body.charCodeAt(position + 1) === 0x002e &&
          body.charCodeAt(position + 2) === 0x002e
        ) {
          return createToken(lexer, TokenKind.SPREAD, position, position + 3);
        }
        break;
      case 0x003a: // :
        return createToken(lexer, TokenKind.COLON, position, position + 1);
      case 0x003d: // =
        return createToken(lexer, TokenKind.EQUALS, position, position + 1);
      case 0x0040: // @
        return createToken(lexer, TokenKind.AT, position, position + 1);
      case 0x005b: // [
        return createToken(lexer, TokenKind.BRACKET_L, position, position + 1);
      case 0x005d: // ]
        return createToken(lexer, TokenKind.BRACKET_R, position, position + 1);
      case 0x007b: // {
        return createToken(lexer, TokenKind.BRACE_L, position, position + 1);
      case 0x007c: // |
        return createToken(lexer, TokenKind.PIPE, position, position + 1);
      case 0x007d: // }
        return createToken(lexer, TokenKind.BRACE_R, position, position + 1);
      case 0x0022: // "
        if (
          body.charCodeAt(position + 1) === 0x0022 &&
          body.charCodeAt(position + 2) === 0x0022
        ) {
          return readBlockString(lexer, position);
        }
        return readString(lexer, position);
    }

    // IntValue | FloatValue
    // 0-9 | -
    if (isDigit(code) || code === 0x002d) {
      return readNumber(lexer, position, code);
    }

    // Name
    if (isNameStart(code)) {
      return readName(lexer, position);
    }

    throw syntaxError(lexer.source, position, unexpectedCharacterMessage(code));
  }

  return createToken(lexer, TokenKind.EOF, bodyLength, bodyLength);
}

/**
 * Report a message that an unexpected character was encountered.
 */
function unexpectedCharacterMessage(code: number): string {
  if (code < 0x0020 && code !== 0x0009 && code !== 0x000a && code !== 0x000d) {
    return `Cannot contain the invalid character ${printCharCode(code)}.`;
  }

  if (code === 0x0027) {
    // '
    return 'Unexpected single quote character (\'), did you mean to use a double quote (")?';
  }

  return `Cannot parse the unexpected character ${printCharCode(code)}.`;
}

/**
 * Reads a comment token from the source file.
 *
 * #[\u0009\u0020-\uFFFF]*
 */
function readComment(lexer: Lexer, start: number): Token {
  const body = lexer.source.body;
  let code;
  let position = start;

  do {
    code = body.charCodeAt(++position);
  } while (
    !isNaN(code) &&
    // SourceCharacter but not LineTerminator
    (code > 0x001f || code === 0x0009)
  );

  return createToken(
    lexer,
    TokenKind.COMMENT,
    start,
    position,
    body.slice(start + 1, position),
  );
}

/**
 * Reads a number token from the source file, either a float
 * or an int depending on whether a decimal point appears.
 *
 * Int:   -?(0|[1-9][0-9]*)
 * Float: -?(0|[1-9][0-9]*)(\.[0-9]+)?((E|e)(+|-)?[0-9]+)?
 */
function readNumber(lexer: Lexer, start: number, firstCode: number): Token {
  const body = lexer.source.body;
  let code = firstCode;
  let position = start;
  let isFloat = false;

  if (code === 0x002d) {
    // -
    code = body.charCodeAt(++position);
  }

  if (code === 0x0030) {
    // 0
    code = body.charCodeAt(++position);
    if (isDigit(code)) {
      throw syntaxError(
        lexer.source,
        position,
        `Invalid number, unexpected digit after 0: ${printCharCode(code)}.`,
      );
    }
  } else {
    position = readDigits(lexer, position, code);
    code = body.charCodeAt(position);
  }

  if (code === 0x002e) {
    // .
    isFloat = true;

    code = body.charCodeAt(++position);
    position = readDigits(lexer, position, code);
    code = body.charCodeAt(position);
  }

  if (code === 0x0045 || code === 0x0065) {
    // E e
    isFloat = true;

    code = body.charCodeAt(++position);
    if (code === 0x002b || code === 0x002d) {
      // + -
      code = body.charCodeAt(++position);
    }
    position = readDigits(lexer, position, code);
    code = body.charCodeAt(position);
  }

  // Numbers cannot be followed by . or NameStart
  if (code === 0x002e || isNameStart(code)) {
    throw syntaxError(
      lexer.source,
      position,
      `Invalid number, expected digit but got: ${printCharCode(code)}.`,
    );
  }

  return createToken(
    lexer,
    isFloat ? TokenKind.FLOAT : TokenKind.INT,
    start,
    position,
    body.slice(start, position),
  );
}

/**
 * Returns the new position in the source after reading digits.
 */
function readDigits(lexer: Lexer, start: number, firstCode: number): number {
  if (!isDigit(firstCode)) {
    throw syntaxError(
      lexer.source,
      start,
      `Invalid number, expected digit but got: ${printCharCode(firstCode)}.`,
    );
  }

  const body = lexer.source.body;
  let position = start;
  let code = firstCode;
  do {
    code = body.charCodeAt(++position);
  } while (isDigit(code));
  return position;
}

// 0 - 9
function isDigit(code: number): boolean {
  return code >= 0x0030 && code <= 0x0039;
}

/**
 * Reads a string token from the source file.
 *
 * "([^"\\\u000A\u000D]|(\\(u[0-9a-fA-F]{4}|["\\/bfnrt])))*"
 */
function readString(lexer: Lexer, start: number): Token {
  const body = lexer.source.body;
  let position = start + 1;
  let chunkStart = position;
  let code = 0;
  let value = '';

  while (
    position < body.length &&
    !isNaN((code = body.charCodeAt(position))) &&
    // not LineTerminator
    code !== 0x000a &&
    code !== 0x000d
  ) {
    // Closing Quote (")
    if (code === 0x0022) {
      value += body.slice(chunkStart, position);
      return createToken(lexer, TokenKind.STRING, start, position + 1, value);
    }

    // SourceCharacter
    if (code < 0x0020 && code !== 0x0009) {
      throw syntaxError(
        lexer.source,
        position,
        `Invalid character within String: ${printCharCode(code)}.`,
      );
    }

    ++position;
    if (code === 0x005c) {
      // \
      value += body.slice(chunkStart, position - 1);
      code = body.charCodeAt(position);
      switch (code) {
        case 0x0022:
          value += '"';
          break;
        case 0x002f:
          value += '/';
          break;
        case 0x005c:
          value += '\\';
          break;
        case 0x0062:
          value += '\b';
          break;
        case 0x0066:
          value += '\f';
          break;
        case 0x006e:
          value += '\n';
          break;
        case 0x0072:
          value += '\r';
          break;
        case 0x0074:
          value += '\t';
          break;
        case 0x0075: {
          // uXXXX
          const charCode = uniCharCode(
            body.charCodeAt(position + 1),
            body.charCodeAt(position + 2),
            body.charCodeAt(position + 3),
            body.charCodeAt(position + 4),
          );
          if (charCode < 0) {
            const invalidSequence = body.slice(position + 1, position + 5);
            throw syntaxError(
              lexer.source,
              position,
              `Invalid character escape sequence: \\u${invalidSequence}.`,
            );
          }
          value += String.fromCharCode(charCode);
          position += 4;
          break;
        }
        default:
          throw syntaxError(
            lexer.source,
            position,
            `Invalid character escape sequence: \\${String.fromCharCode(
              code,
            )}.`,
          );
      }
      ++position;
      chunkStart = position;
    }
  }

  throw syntaxError(lexer.source, position, 'Unterminated string.');
}

/**
 * Reads a block string token from the source file.
 *
 * """("?"?(\\"""|\\(?!=""")|[^"\\]))*"""
 */
function readBlockString(lexer: Lexer, start: number): Token {
  const body = lexer.source.body;
  let position = start + 3;
  let chunkStart = position;
  let code = 0;
  let rawValue = '';

  while (position < body.length && !isNaN((code = body.charCodeAt(position)))) {
    // Closing Triple-Quote (""")
    if (
      code === 0x0022 &&
      body.charCodeAt(position + 1) === 0x0022 &&
      body.charCodeAt(position + 2) === 0x0022
    ) {
      rawValue += body.slice(chunkStart, position);
      return createToken(
        lexer,
        TokenKind.BLOCK_STRING,
        start,
        position + 3,
        dedentBlockStringValue(rawValue),
      );
    }

    // SourceCharacter
    if (
      code < 0x0020 &&
      code !== 0x0009 &&
      code !== 0x000a &&
      code !== 0x000d
    ) {
      throw syntaxError(
        lexer.source,
        position,
        `Invalid character within String: ${printCharCode(code)}.`,
      );
    }

    if (code === 0x000a) {
      // new line
      ++position;
      ++lexer.line;
      lexer.lineStart = position;
    } else if (code === 0x000d) {
      // carriage return
      if (body.charCodeAt(position + 1) === 0x000a) {
        position += 2;
      } else {
        ++position;
      }
      ++lexer.line;
      lexer.lineStart = position;
    } else if (
      // Escape Triple-Quote (\""")
      code === 0x005c &&
      body.charCodeAt(position + 1) === 0x0022 &&
      body.charCodeAt(position + 2) === 0x0022 &&
      body.charCodeAt(position + 3) === 0x0022
    ) {
      rawValue += body.slice(chunkStart, position) + '"""';
      position += 4;
      chunkStart = position;
    } else {
      ++position;
    }
  }

  throw syntaxError(lexer.source, position, 'Unterminated string.');
}

/**
 * Converts four hexadecimal chars to the integer that the
 * string represents. For example, uniCharCode('0','0','0','f')
 * will return 15, and uniCharCode('0','0','f','f') returns 255.
 *
 * Returns a negative number on error, if a char was invalid.
 *
 * This is implemented by noting that char2hex() returns -1 on error,
 * which means the result of ORing the char2hex() will also be negative.
 */
function uniCharCode(a: number, b: number, c: number, d: number): number {
  return (
    (char2hex(a) << 12) | (char2hex(b) << 8) | (char2hex(c) << 4) | char2hex(d)
  );
}

/**
 * Converts a hex character to its integer value.
 * '0' becomes 0, '9' becomes 9
 * 'A' becomes 10, 'F' becomes 15
 * 'a' becomes 10, 'f' becomes 15
 *
 * Returns -1 on error.
 */
function char2hex(a: number): number {
  return isDigit(a)
    ? a - 0x0030 // 0-9
    : a >= 0x0041 && a <= 0x0046
    ? a - 0x0037 // A-F
    : a >= 0x0061 && a <= 0x0066
    ? a - 0x0057 // a-f
    : -1;
}

/**
 * Reads an alphanumeric + underscore name from the source.
 *
 * [_A-Za-z][_0-9A-Za-z]*
 */
function readName(lexer: Lexer, start: number): Token {
  const body = lexer.source.body;
  const bodyLength = body.length;
  let position = start + 1;
  let code = 0;
  while (
    position !== bodyLength &&
    !isNaN((code = body.charCodeAt(position))) &&
    (code === 0x005f || // _
      isDigit(code) ||
      (code >= 0x0041 && code <= 0x005a) || // A-Z
      (code >= 0x0061 && code <= 0x007a)) // a-z
  ) {
    ++position;
  }
  return createToken(
    lexer,
    TokenKind.NAME,
    start,
    position,
    body.slice(start, position),
  );
}

// a-z | A-Z | _
function isNameStart(code: number): boolean {
  return (
    (code >= 0x0061 && code <= 0x007a) ||
    (code >= 0x0041 && code <= 0x005a) ||
    code === 0x005f
  );
}
