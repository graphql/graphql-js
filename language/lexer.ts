import { syntaxError } from '../error/syntaxError.ts';
import { Token } from './ast.ts';
import { dedentBlockStringLines } from './blockString.ts';
import { isDigit, isNameContinue, isNameStart } from './characterClasses.ts';
import type { Source } from './source.ts';
import { TokenKind } from './tokenKind.ts';
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
  get [Symbol.toStringTag]() {
    return 'Lexer';
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
export function isPunctuatorTokenKind(kind: TokenKind): boolean {
  return (
    kind === TokenKind.BANG ||
    kind === TokenKind.QUESTION_MARK ||
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
/**
 * A Unicode scalar value is any Unicode code point except surrogate code
 * points. In other words, the inclusive ranges of values 0x0000 to 0xD7FF and
 * 0xE000 to 0x10FFFF.
 *
 * SourceCharacter ::
 *   - "Any Unicode scalar value"
 */
function isUnicodeScalarValue(code: number): boolean {
  return (code >= 0 && code <= 55295) || (code >= 57344 && code <= 1114111);
}
/**
 * The GraphQL specification defines source text as a sequence of unicode scalar
 * values (which Unicode defines to exclude surrogate code points). However
 * JavaScript defines strings as a sequence of UTF-16 code units which may
 * include surrogates. A surrogate pair is a valid source character as it
 * encodes a supplementary code point (above U+FFFF), but unpaired surrogate
 * code points are not valid source characters.
 */
function isSupplementaryCodePoint(body: string, location: number): boolean {
  return (
    isLeadingSurrogate(body.charCodeAt(location)) &&
    isTrailingSurrogate(body.charCodeAt(location + 1))
  );
}
function isLeadingSurrogate(code: number): boolean {
  return code >= 55296 && code <= 56319;
}
function isTrailingSurrogate(code: number): boolean {
  return code >= 56320 && code <= 57343;
}
/**
 * Prints the code point (or end of file reference) at a given location in a
 * source for use in error messages.
 *
 * Printable ASCII is printed quoted, while other points are printed in Unicode
 * code point form (ie. U+1234).
 */
function printCodePointAt(lexer: Lexer, location: number): string {
  const code = lexer.source.body.codePointAt(location);
  if (code === undefined) {
    return TokenKind.EOF;
  } else if (code >= 32 && code <= 126) {
    // Printable ASCII
    const char = String.fromCodePoint(code);
    return char === '"' ? "'\"'" : `"${char}"`;
  }
  // Unicode code point
  return 'U+' + code.toString(16).toUpperCase().padStart(4, '0');
}
/**
 * Create a token with line and column location information.
 */
function createToken(
  lexer: Lexer,
  kind: TokenKind,
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
      // Ignored ::
      //   - UnicodeBOM
      //   - WhiteSpace
      //   - LineTerminator
      //   - Comment
      //   - Comma
      //
      // UnicodeBOM :: "Byte Order Mark (U+FEFF)"
      //
      // WhiteSpace ::
      //   - "Horizontal Tab (U+0009)"
      //   - "Space (U+0020)"
      //
      // Comma :: ,
      case 65279: // <BOM>
      case 9: // \t
      case 32: // <space>
      case 44: // ,
        ++position;
        continue;
      // LineTerminator ::
      //   - "New Line (U+000A)"
      //   - "Carriage Return (U+000D)" [lookahead != "New Line (U+000A)"]
      //   - "Carriage Return (U+000D)" "New Line (U+000A)"
      case 10: // \n
        ++position;
        ++lexer.line;
        lexer.lineStart = position;
        continue;
      case 13: // \r
        if (body.charCodeAt(position + 1) === 10) {
          position += 2;
        } else {
          ++position;
        }
        ++lexer.line;
        lexer.lineStart = position;
        continue;
      // Comment
      case 35: // #
        return readComment(lexer, position);
      // Token ::
      //   - Punctuator
      //   - Name
      //   - IntValue
      //   - FloatValue
      //   - StringValue
      //
      // Punctuator :: one of ! $ & ( ) ... : = @ [ ] { | }
      case 33: // !
        return createToken(lexer, TokenKind.BANG, position, position + 1);
      case 36: // $
        return createToken(lexer, TokenKind.DOLLAR, position, position + 1);
      case 38: // &
        return createToken(lexer, TokenKind.AMP, position, position + 1);
      case 40: // (
        return createToken(lexer, TokenKind.PAREN_L, position, position + 1);
      case 41: // )
        return createToken(lexer, TokenKind.PAREN_R, position, position + 1);
      case 46: // .
        if (
          body.charCodeAt(position + 1) === 46 &&
          body.charCodeAt(position + 2) === 46
        ) {
          return createToken(lexer, TokenKind.SPREAD, position, position + 3);
        }
        break;
      case 58: // :
        return createToken(lexer, TokenKind.COLON, position, position + 1);
      case 61: // =
        return createToken(lexer, TokenKind.EQUALS, position, position + 1);
      case 64: // @
        return createToken(lexer, TokenKind.AT, position, position + 1);
      case 91: // [
        return createToken(lexer, TokenKind.BRACKET_L, position, position + 1);
      case 93: // ]
        return createToken(lexer, TokenKind.BRACKET_R, position, position + 1);
      case 123: // {
        return createToken(lexer, TokenKind.BRACE_L, position, position + 1);
      case 124: // |
        return createToken(lexer, TokenKind.PIPE, position, position + 1);
      case 125: // }
        return createToken(lexer, TokenKind.BRACE_R, position, position + 1);
      case 63: // ?
        return createToken(
          lexer,
          TokenKind.QUESTION_MARK,
          position,
          position + 1,
        );
      // StringValue
      case 34: // "
        if (
          body.charCodeAt(position + 1) === 34 &&
          body.charCodeAt(position + 2) === 34
        ) {
          return readBlockString(lexer, position);
        }
        return readString(lexer, position);
    }
    // IntValue | FloatValue (Digit | -)
    if (isDigit(code) || code === 45) {
      return readNumber(lexer, position, code);
    }
    // Name
    if (isNameStart(code)) {
      return readName(lexer, position);
    }
    throw syntaxError(
      lexer.source,
      position,
      code === 39
        ? 'Unexpected single quote character (\'), did you mean to use a double quote (")?'
        : isUnicodeScalarValue(code) || isSupplementaryCodePoint(body, position)
        ? `Unexpected character: ${printCodePointAt(lexer, position)}.`
        : `Invalid character: ${printCodePointAt(lexer, position)}.`,
    );
  }
  return createToken(lexer, TokenKind.EOF, bodyLength, bodyLength);
}
/**
 * Reads a comment token from the source file.
 *
 * ```
 * Comment :: # CommentChar* [lookahead != CommentChar]
 *
 * CommentChar :: SourceCharacter but not LineTerminator
 * ```
 */
function readComment(lexer: Lexer, start: number): Token {
  const body = lexer.source.body;
  const bodyLength = body.length;
  let position = start + 1;
  while (position < bodyLength) {
    const code = body.charCodeAt(position);
    // LineTerminator (\n | \r)
    if (code === 10 || code === 13) {
      break;
    }
    // SourceCharacter
    if (isUnicodeScalarValue(code)) {
      ++position;
    } else if (isSupplementaryCodePoint(body, position)) {
      position += 2;
    } else {
      break;
    }
  }
  return createToken(
    lexer,
    TokenKind.COMMENT,
    start,
    position,
    body.slice(start + 1, position),
  );
}
/**
 * Reads a number token from the source file, either a FloatValue or an IntValue
 * depending on whether a FractionalPart or ExponentPart is encountered.
 *
 * ```
 * IntValue :: IntegerPart [lookahead != {Digit, `.`, NameStart}]
 *
 * IntegerPart ::
 *   - NegativeSign? 0
 *   - NegativeSign? NonZeroDigit Digit*
 *
 * NegativeSign :: -
 *
 * NonZeroDigit :: Digit but not `0`
 *
 * FloatValue ::
 *   - IntegerPart FractionalPart ExponentPart [lookahead != {Digit, `.`, NameStart}]
 *   - IntegerPart FractionalPart [lookahead != {Digit, `.`, NameStart}]
 *   - IntegerPart ExponentPart [lookahead != {Digit, `.`, NameStart}]
 *
 * FractionalPart :: . Digit+
 *
 * ExponentPart :: ExponentIndicator Sign? Digit+
 *
 * ExponentIndicator :: one of `e` `E`
 *
 * Sign :: one of + -
 * ```
 */
function readNumber(lexer: Lexer, start: number, firstCode: number): Token {
  const body = lexer.source.body;
  let position = start;
  let code = firstCode;
  let isFloat = false;
  // NegativeSign (-)
  if (code === 45) {
    code = body.charCodeAt(++position);
  }
  // Zero (0)
  if (code === 48) {
    code = body.charCodeAt(++position);
    if (isDigit(code)) {
      throw syntaxError(
        lexer.source,
        position,
        `Invalid number, unexpected digit after 0: ${printCodePointAt(
          lexer,
          position,
        )}.`,
      );
    }
  } else {
    position = readDigits(lexer, position, code);
    code = body.charCodeAt(position);
  }
  // Full stop (.)
  if (code === 46) {
    isFloat = true;
    code = body.charCodeAt(++position);
    position = readDigits(lexer, position, code);
    code = body.charCodeAt(position);
  }
  // E e
  if (code === 69 || code === 101) {
    isFloat = true;
    code = body.charCodeAt(++position);
    // + -
    if (code === 43 || code === 45) {
      code = body.charCodeAt(++position);
    }
    position = readDigits(lexer, position, code);
    code = body.charCodeAt(position);
  }
  // Numbers cannot be followed by . or NameStart
  if (code === 46 || isNameStart(code)) {
    throw syntaxError(
      lexer.source,
      position,
      `Invalid number, expected digit but got: ${printCodePointAt(
        lexer,
        position,
      )}.`,
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
 * Returns the new position in the source after reading one or more digits.
 */
function readDigits(lexer: Lexer, start: number, firstCode: number): number {
  if (!isDigit(firstCode)) {
    throw syntaxError(
      lexer.source,
      start,
      `Invalid number, expected digit but got: ${printCodePointAt(
        lexer,
        start,
      )}.`,
    );
  }
  const body = lexer.source.body;
  let position = start + 1; // +1 to skip first firstCode
  while (isDigit(body.charCodeAt(position))) {
    ++position;
  }
  return position;
}
/**
 * Reads a single-quote string token from the source file.
 *
 * ```
 * StringValue ::
 *   - `""` [lookahead != `"`]
 *   - `"` StringCharacter+ `"`
 *
 * StringCharacter ::
 *   - SourceCharacter but not `"` or `\` or LineTerminator
 *   - `\u` EscapedUnicode
 *   - `\` EscapedCharacter
 *
 * EscapedUnicode ::
 *   - `{` HexDigit+ `}`
 *   - HexDigit HexDigit HexDigit HexDigit
 *
 * EscapedCharacter :: one of `"` `\` `/` `b` `f` `n` `r` `t`
 * ```
 */
function readString(lexer: Lexer, start: number): Token {
  const body = lexer.source.body;
  const bodyLength = body.length;
  let position = start + 1;
  let chunkStart = position;
  let value = '';
  while (position < bodyLength) {
    const code = body.charCodeAt(position);
    // Closing Quote (")
    if (code === 34) {
      value += body.slice(chunkStart, position);
      return createToken(lexer, TokenKind.STRING, start, position + 1, value);
    }
    // Escape Sequence (\)
    if (code === 92) {
      value += body.slice(chunkStart, position);
      const escape =
        body.charCodeAt(position + 1) === 117 // u
          ? body.charCodeAt(position + 2) === 123 // {
            ? readEscapedUnicodeVariableWidth(lexer, position)
            : readEscapedUnicodeFixedWidth(lexer, position)
          : readEscapedCharacter(lexer, position);
      value += escape.value;
      position += escape.size;
      chunkStart = position;
      continue;
    }
    // LineTerminator (\n | \r)
    if (code === 10 || code === 13) {
      break;
    }
    // SourceCharacter
    if (isUnicodeScalarValue(code)) {
      ++position;
    } else if (isSupplementaryCodePoint(body, position)) {
      position += 2;
    } else {
      throw syntaxError(
        lexer.source,
        position,
        `Invalid character within String: ${printCodePointAt(
          lexer,
          position,
        )}.`,
      );
    }
  }
  throw syntaxError(lexer.source, position, 'Unterminated string.');
}
// The string value and lexed size of an escape sequence.
interface EscapeSequence {
  value: string;
  size: number;
}
function readEscapedUnicodeVariableWidth(
  lexer: Lexer,
  position: number,
): EscapeSequence {
  const body = lexer.source.body;
  let point = 0;
  let size = 3;
  // Cannot be larger than 12 chars (\u{00000000}).
  while (size < 12) {
    const code = body.charCodeAt(position + size++);
    // Closing Brace (})
    if (code === 125) {
      // Must be at least 5 chars (\u{0}) and encode a Unicode scalar value.
      if (size < 5 || !isUnicodeScalarValue(point)) {
        break;
      }
      return { value: String.fromCodePoint(point), size };
    }
    // Append this hex digit to the code point.
    point = (point << 4) | readHexDigit(code);
    if (point < 0) {
      break;
    }
  }
  throw syntaxError(
    lexer.source,
    position,
    `Invalid Unicode escape sequence: "${body.slice(
      position,
      position + size,
    )}".`,
  );
}
function readEscapedUnicodeFixedWidth(
  lexer: Lexer,
  position: number,
): EscapeSequence {
  const body = lexer.source.body;
  const code = read16BitHexCode(body, position + 2);
  if (isUnicodeScalarValue(code)) {
    return { value: String.fromCodePoint(code), size: 6 };
  }
  // GraphQL allows JSON-style surrogate pair escape sequences, but only when
  // a valid pair is formed.
  if (isLeadingSurrogate(code)) {
    // \u
    if (
      body.charCodeAt(position + 6) === 92 &&
      body.charCodeAt(position + 7) === 117
    ) {
      const trailingCode = read16BitHexCode(body, position + 8);
      if (isTrailingSurrogate(trailingCode)) {
        // JavaScript defines strings as a sequence of UTF-16 code units and
        // encodes Unicode code points above U+FFFF using a surrogate pair of
        // code units. Since this is a surrogate pair escape sequence, just
        // include both codes into the JavaScript string value. Had JavaScript
        // not been internally based on UTF-16, then this surrogate pair would
        // be decoded to retrieve the supplementary code point.
        return { value: String.fromCodePoint(code, trailingCode), size: 12 };
      }
    }
  }
  throw syntaxError(
    lexer.source,
    position,
    `Invalid Unicode escape sequence: "${body.slice(position, position + 6)}".`,
  );
}
/**
 * Reads four hexadecimal characters and returns the positive integer that 16bit
 * hexadecimal string represents. For example, "000f" will return 15, and "dead"
 * will return 57005.
 *
 * Returns a negative number if any char was not a valid hexadecimal digit.
 */
function read16BitHexCode(body: string, position: number): number {
  // readHexDigit() returns -1 on error. ORing a negative value with any other
  // value always produces a negative value.
  return (
    (readHexDigit(body.charCodeAt(position)) << 12) |
    (readHexDigit(body.charCodeAt(position + 1)) << 8) |
    (readHexDigit(body.charCodeAt(position + 2)) << 4) |
    readHexDigit(body.charCodeAt(position + 3))
  );
}
/**
 * Reads a hexadecimal character and returns its positive integer value (0-15).
 *
 * '0' becomes 0, '9' becomes 9
 * 'A' becomes 10, 'F' becomes 15
 * 'a' becomes 10, 'f' becomes 15
 *
 * Returns -1 if the provided character code was not a valid hexadecimal digit.
 *
 * HexDigit :: one of
 *   - `0` `1` `2` `3` `4` `5` `6` `7` `8` `9`
 *   - `A` `B` `C` `D` `E` `F`
 *   - `a` `b` `c` `d` `e` `f`
 */
function readHexDigit(code: number): number {
  return code >= 48 && code <= 57 // 0-9
    ? code - 48
    : code >= 65 && code <= 70 // A-F
    ? code - 55
    : code >= 97 && code <= 102 // a-f
    ? code - 87
    : -1;
}
/**
 * | Escaped Character | Code Point | Character Name               |
 * | ----------------- | ---------- | ---------------------------- |
 * | `"`               | U+0022     | double quote                 |
 * | `\`               | U+005C     | reverse solidus (back slash) |
 * | `/`               | U+002F     | solidus (forward slash)      |
 * | `b`               | U+0008     | backspace                    |
 * | `f`               | U+000C     | form feed                    |
 * | `n`               | U+000A     | line feed (new line)         |
 * | `r`               | U+000D     | carriage return              |
 * | `t`               | U+0009     | horizontal tab               |
 */
function readEscapedCharacter(lexer: Lexer, position: number): EscapeSequence {
  const body = lexer.source.body;
  const code = body.charCodeAt(position + 1);
  switch (code) {
    case 34: // "
      return { value: '"', size: 2 };
    case 92: // \
      return { value: '\\', size: 2 };
    case 47: // /
      return { value: '/', size: 2 };
    case 98: // b
      return { value: '\b', size: 2 };
    case 102: // f
      return { value: '\f', size: 2 };
    case 110: // n
      return { value: '\n', size: 2 };
    case 114: // r
      return { value: '\r', size: 2 };
    case 116: // t
      return { value: '\t', size: 2 };
  }
  throw syntaxError(
    lexer.source,
    position,
    `Invalid character escape sequence: "${body.slice(
      position,
      position + 2,
    )}".`,
  );
}
/**
 * Reads a block string token from the source file.
 *
 * ```
 * StringValue ::
 *   - `"""` BlockStringCharacter* `"""`
 *
 * BlockStringCharacter ::
 *   - SourceCharacter but not `"""` or `\"""`
 *   - `\"""`
 * ```
 */
function readBlockString(lexer: Lexer, start: number): Token {
  const body = lexer.source.body;
  const bodyLength = body.length;
  let lineStart = lexer.lineStart;
  let position = start + 3;
  let chunkStart = position;
  let currentLine = '';
  const blockLines = [];
  while (position < bodyLength) {
    const code = body.charCodeAt(position);
    // Closing Triple-Quote (""")
    if (
      code === 34 &&
      body.charCodeAt(position + 1) === 34 &&
      body.charCodeAt(position + 2) === 34
    ) {
      currentLine += body.slice(chunkStart, position);
      blockLines.push(currentLine);
      const token = createToken(
        lexer,
        TokenKind.BLOCK_STRING,
        start,
        position + 3,
        // Return a string of the lines joined with U+000A.
        dedentBlockStringLines(blockLines).join('\n'),
      );
      lexer.line += blockLines.length - 1;
      lexer.lineStart = lineStart;
      return token;
    }
    // Escaped Triple-Quote (\""")
    if (
      code === 92 &&
      body.charCodeAt(position + 1) === 34 &&
      body.charCodeAt(position + 2) === 34 &&
      body.charCodeAt(position + 3) === 34
    ) {
      currentLine += body.slice(chunkStart, position);
      chunkStart = position + 1; // skip only slash
      position += 4;
      continue;
    }
    // LineTerminator
    if (code === 10 || code === 13) {
      currentLine += body.slice(chunkStart, position);
      blockLines.push(currentLine);
      if (code === 13 && body.charCodeAt(position + 1) === 10) {
        position += 2;
      } else {
        ++position;
      }
      currentLine = '';
      chunkStart = position;
      lineStart = position;
      continue;
    }
    // SourceCharacter
    if (isUnicodeScalarValue(code)) {
      ++position;
    } else if (isSupplementaryCodePoint(body, position)) {
      position += 2;
    } else {
      throw syntaxError(
        lexer.source,
        position,
        `Invalid character within String: ${printCodePointAt(
          lexer,
          position,
        )}.`,
      );
    }
  }
  throw syntaxError(lexer.source, position, 'Unterminated string.');
}
/**
 * Reads an alphanumeric + underscore name from the source.
 *
 * ```
 * Name ::
 *   - NameStart NameContinue* [lookahead != NameContinue]
 * ```
 */
function readName(lexer: Lexer, start: number): Token {
  const body = lexer.source.body;
  const bodyLength = body.length;
  let position = start + 1;
  while (position < bodyLength) {
    const code = body.charCodeAt(position);
    if (isNameContinue(code)) {
      ++position;
    } else {
      break;
    }
  }
  return createToken(
    lexer,
    TokenKind.NAME,
    start,
    position,
    body.slice(start, position),
  );
}
