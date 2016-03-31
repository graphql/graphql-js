'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TokenKind = undefined;

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

exports.lex = lex;
exports.getTokenDesc = getTokenDesc;
exports.getTokenKindDesc = getTokenKindDesc;

var _error = require('../error');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Given a Source object, this returns a Lexer for that source.
 * A Lexer is a function that acts like a generator in that every time
 * it is called, it returns the next token in the Source. Assuming the
 * source lexes, the final Token emitted by the lexer will be of kind
 * EOF, after which the lexer will repeatedly return EOF tokens whenever
 * called.
 *
 * The argument to the lexer function is optional, and can be used to
 * rewind or fast forward the lexer to a new position in the source.
 */


/**
 * A representation of a lexed Token. Value only appears for non-punctuation
 * tokens: NAME, INT, FLOAT, and STRING.
 */
/*  /
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

function lex(source) {
  var prevPosition = 0;
  return function nextToken(resetPosition) {
    var token = readToken(source, resetPosition === undefined ? prevPosition : resetPosition);
    prevPosition = token.end;
    return token;
  };
}

/**
 * An enum describing the different kinds of tokens that the lexer emits.
 */
var TokenKind = exports.TokenKind = {
  EOF: 1,
  BANG: 2,
  DOLLAR: 3,
  PAREN_L: 4,
  PAREN_R: 5,
  SPREAD: 6,
  COLON: 7,
  EQUALS: 8,
  AT: 9,
  BRACKET_L: 10,
  BRACKET_R: 11,
  BRACE_L: 12,
  PIPE: 13,
  BRACE_R: 14,
  NAME: 15,
  INT: 16,
  FLOAT: 17,
  STRING: 18
};

/**
 * A helper function to describe a token as a string for debugging
 */
function getTokenDesc(token) {
  return token.value ? getTokenKindDesc(token.kind) + ' "' + token.value + '"' : getTokenKindDesc(token.kind);
}

/**
 * A helper function to describe a token kind as a string for debugging
 */
function getTokenKindDesc(kind) {
  return tokenDescription[kind];
}

var tokenDescription = {};
tokenDescription[TokenKind.EOF] = 'EOF';
tokenDescription[TokenKind.BANG] = '!';
tokenDescription[TokenKind.DOLLAR] = '$';
tokenDescription[TokenKind.PAREN_L] = '(';
tokenDescription[TokenKind.PAREN_R] = ')';
tokenDescription[TokenKind.SPREAD] = '...';
tokenDescription[TokenKind.COLON] = ':';
tokenDescription[TokenKind.EQUALS] = '=';
tokenDescription[TokenKind.AT] = '@';
tokenDescription[TokenKind.BRACKET_L] = '[';
tokenDescription[TokenKind.BRACKET_R] = ']';
tokenDescription[TokenKind.BRACE_L] = '{';
tokenDescription[TokenKind.PIPE] = '|';
tokenDescription[TokenKind.BRACE_R] = '}';
tokenDescription[TokenKind.NAME] = 'Name';
tokenDescription[TokenKind.INT] = 'Int';
tokenDescription[TokenKind.FLOAT] = 'Float';
tokenDescription[TokenKind.STRING] = 'String';

var charCodeAt = String.prototype.charCodeAt;
var slice = String.prototype.slice;

/**
 * Helper function for constructing the Token object.
 */
function makeToken(kind, start, end, value) {
  return { kind: kind, start: start, end: end, value: value };
}

function printCharCode(code) {
  return(
    // NaN/undefined represents access beyond the end of the file.
    isNaN(code) ? '<EOF>' :
    // Trust JSON for ASCII.
    code < 0x007F ? (0, _stringify2.default)(String.fromCharCode(code)) :
    // Otherwise print the escaped form.
    '"\\u' + ('00' + code.toString(16).toUpperCase()).slice(-4) + '"'
  );
}

/**
 * Gets the next token from the source starting at the given position.
 *
 * This skips over whitespace and comments until it finds the next lexable
 * token, then lexes punctuators immediately or calls the appropriate helper
 * function for more complicated tokens.
 */
function readToken(source, fromPosition) {
  var body = source.body;
  var bodyLength = body.length;

  var position = positionAfterWhitespace(body, fromPosition);

  if (position >= bodyLength) {
    return makeToken(TokenKind.EOF, position, position);
  }

  var code = charCodeAt.call(body, position);

  // SourceCharacter
  if (code < 0x0020 && code !== 0x0009 && code !== 0x000A && code !== 0x000D) {
    throw (0, _error.syntaxError)(source, position, 'Invalid character ' + printCharCode(code) + '.');
  }

  switch (code) {
    // !
    case 33:
      return makeToken(TokenKind.BANG, position, position + 1);
    // $
    case 36:
      return makeToken(TokenKind.DOLLAR, position, position + 1);
    // (
    case 40:
      return makeToken(TokenKind.PAREN_L, position, position + 1);
    // )
    case 41:
      return makeToken(TokenKind.PAREN_R, position, position + 1);
    // .
    case 46:
      if (charCodeAt.call(body, position + 1) === 46 && charCodeAt.call(body, position + 2) === 46) {
        return makeToken(TokenKind.SPREAD, position, position + 3);
      }
      break;
    // :
    case 58:
      return makeToken(TokenKind.COLON, position, position + 1);
    // =
    case 61:
      return makeToken(TokenKind.EQUALS, position, position + 1);
    // @
    case 64:
      return makeToken(TokenKind.AT, position, position + 1);
    // [
    case 91:
      return makeToken(TokenKind.BRACKET_L, position, position + 1);
    // ]
    case 93:
      return makeToken(TokenKind.BRACKET_R, position, position + 1);
    // {
    case 123:
      return makeToken(TokenKind.BRACE_L, position, position + 1);
    // |
    case 124:
      return makeToken(TokenKind.PIPE, position, position + 1);
    // }
    case 125:
      return makeToken(TokenKind.BRACE_R, position, position + 1);
    // A-Z
    case 65:case 66:case 67:case 68:case 69:case 70:case 71:case 72:
    case 73:case 74:case 75:case 76:case 77:case 78:case 79:case 80:
    case 81:case 82:case 83:case 84:case 85:case 86:case 87:case 88:
    case 89:case 90:
    // _
    case 95:
    // a-z
    case 97:case 98:case 99:case 100:case 101:case 102:case 103:case 104:
    case 105:case 106:case 107:case 108:case 109:case 110:case 111:
    case 112:case 113:case 114:case 115:case 116:case 117:case 118:
    case 119:case 120:case 121:case 122:
      return readName(source, position);
    // -
    case 45:
    // 0-9
    case 48:case 49:case 50:case 51:case 52:
    case 53:case 54:case 55:case 56:case 57:
      return readNumber(source, position, code);
    // "
    case 34:
      return readString(source, position);
  }

  throw (0, _error.syntaxError)(source, position, 'Unexpected character ' + printCharCode(code) + '.');
}

/**
 * Reads from body starting at startPosition until it finds a non-whitespace
 * or commented character, then returns the position of that character for
 * lexing.
 */
function positionAfterWhitespace(body, startPosition) {
  var bodyLength = body.length;
  var position = startPosition;
  while (position < bodyLength) {
    var code = charCodeAt.call(body, position);
    // Skip Ignored
    if (
    // BOM
    code === 0xFEFF ||
    // White Space
    code === 0x0009 || // tab
    code === 0x0020 || // space
    // Line Terminator
    code === 0x000A || // new line
    code === 0x000D || // carriage return
    // Comma
    code === 0x002C) {
      ++position;
      // Skip comments
    } else if (code === 35) {
        // #
        ++position;
        while (position < bodyLength && (code = charCodeAt.call(body, position)) !== null && (
        // SourceCharacter but not LineTerminator
        code > 0x001F || code === 0x0009) && code !== 0x000A && code !== 0x000D) {
          ++position;
        }
      } else {
        break;
      }
  }
  return position;
}

/**
 * Reads a number token from the source file, either a float
 * or an int depending on whether a decimal point appears.
 *
 * Int:   -?(0|[1-9][0-9]*)
 * Float: -?(0|[1-9][0-9]*)(\.[0-9]+)?((E|e)(+|-)?[0-9]+)?
 */
function readNumber(source, start, firstCode) {
  var body = source.body;
  var code = firstCode;
  var position = start;
  var isFloat = false;

  if (code === 45) {
    // -
    code = charCodeAt.call(body, ++position);
  }

  if (code === 48) {
    // 0
    code = charCodeAt.call(body, ++position);
    if (code >= 48 && code <= 57) {
      throw (0, _error.syntaxError)(source, position, 'Invalid number, unexpected digit after 0: ' + printCharCode(code) + '.');
    }
  } else {
    position = readDigits(source, position, code);
    code = charCodeAt.call(body, position);
  }

  if (code === 46) {
    // .
    isFloat = true;

    code = charCodeAt.call(body, ++position);
    position = readDigits(source, position, code);
    code = charCodeAt.call(body, position);
  }

  if (code === 69 || code === 101) {
    // E e
    isFloat = true;

    code = charCodeAt.call(body, ++position);
    if (code === 43 || code === 45) {
      // + -
      code = charCodeAt.call(body, ++position);
    }
    position = readDigits(source, position, code);
  }

  return makeToken(isFloat ? TokenKind.FLOAT : TokenKind.INT, start, position, slice.call(body, start, position));
}

/**
 * Returns the new position in the source after reading digits.
 */
function readDigits(source, start, firstCode) {
  var body = source.body;
  var position = start;
  var code = firstCode;
  if (code >= 48 && code <= 57) {
    // 0 - 9
    do {
      code = charCodeAt.call(body, ++position);
    } while (code >= 48 && code <= 57); // 0 - 9
    return position;
  }
  throw (0, _error.syntaxError)(source, position, 'Invalid number, expected digit but got: ' + printCharCode(code) + '.');
}

/**
 * Reads a string token from the source file.
 *
 * "([^"\\\u000A\u000D]|(\\(u[0-9a-fA-F]{4}|["\\/bfnrt])))*"
 */
function readString(source, start) {
  var body = source.body;
  var position = start + 1;
  var chunkStart = position;
  var code = 0;
  var value = '';

  while (position < body.length && (code = charCodeAt.call(body, position)) !== null &&
  // not LineTerminator
  code !== 0x000A && code !== 0x000D &&
  // not Quote (")
  code !== 34) {
    // SourceCharacter
    if (code < 0x0020 && code !== 0x0009) {
      throw (0, _error.syntaxError)(source, position, 'Invalid character within String: ' + printCharCode(code) + '.');
    }

    ++position;
    if (code === 92) {
      // \
      value += slice.call(body, chunkStart, position - 1);
      code = charCodeAt.call(body, position);
      switch (code) {
        case 34:
          value += '"';break;
        case 47:
          value += '\/';break;
        case 92:
          value += '\\';break;
        case 98:
          value += '\b';break;
        case 102:
          value += '\f';break;
        case 110:
          value += '\n';break;
        case 114:
          value += '\r';break;
        case 116:
          value += '\t';break;
        case 117:
          // u
          var charCode = uniCharCode(charCodeAt.call(body, position + 1), charCodeAt.call(body, position + 2), charCodeAt.call(body, position + 3), charCodeAt.call(body, position + 4));
          if (charCode < 0) {
            throw (0, _error.syntaxError)(source, position, 'Invalid character escape sequence: ' + ('\\u' + body.slice(position + 1, position + 5) + '.'));
          }
          value += String.fromCharCode(charCode);
          position += 4;
          break;
        default:
          throw (0, _error.syntaxError)(source, position, 'Invalid character escape sequence: \\' + String.fromCharCode(code) + '.');
      }
      ++position;
      chunkStart = position;
    }
  }

  if (code !== 34) {
    // quote (")
    throw (0, _error.syntaxError)(source, position, 'Unterminated string.');
  }

  value += slice.call(body, chunkStart, position);
  return makeToken(TokenKind.STRING, start, position + 1, value);
}

/**
 * Converts four hexidecimal chars to the integer that the
 * string represents. For example, uniCharCode('0','0','0','f')
 * will return 15, and uniCharCode('0','0','f','f') returns 255.
 *
 * Returns a negative number on error, if a char was invalid.
 *
 * This is implemented by noting that char2hex() returns -1 on error,
 * which means the result of ORing the char2hex() will also be negative.
 */
function uniCharCode(a, b, c, d) {
  return char2hex(a) << 12 | char2hex(b) << 8 | char2hex(c) << 4 | char2hex(d);
}

/**
 * Converts a hex character to its integer value.
 * '0' becomes 0, '9' becomes 9
 * 'A' becomes 10, 'F' becomes 15
 * 'a' becomes 10, 'f' becomes 15
 *
 * Returns -1 on error.
 */
function char2hex(a) {
  return a >= 48 && a <= 57 ? a - 48 : // 0-9
  a >= 65 && a <= 70 ? a - 55 : // A-F
  a >= 97 && a <= 102 ? a - 87 : // a-f
  -1;
}

/**
 * Reads an alphanumeric + underscore name from the source.
 *
 * [_A-Za-z][_0-9A-Za-z]*
 */
function readName(source, position) {
  var body = source.body;
  var bodyLength = body.length;
  var end = position + 1;
  var code = 0;
  while (end !== bodyLength && (code = charCodeAt.call(body, end)) !== null && (code === 95 || // _
  code >= 48 && code <= 57 || // 0-9
  code >= 65 && code <= 90 || // A-Z
  code >= 97 && code <= 122 // a-z
  )) {
    ++end;
  }
  return makeToken(TokenKind.NAME, position, end, slice.call(body, position, end));
}