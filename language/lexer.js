"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lexer = void 0;
exports.isPunctuatorTokenKind = isPunctuatorTokenKind;
exports.printCodePointAt = printCodePointAt;
exports.createToken = createToken;
exports.readName = readName;
const syntaxError_ts_1 = require("../error/syntaxError.js");
const ast_ts_1 = require("./ast.js");
const blockString_ts_1 = require("./blockString.js");
const characterClasses_ts_1 = require("./characterClasses.js");
const tokenKind_ts_1 = require("./tokenKind.js");
class Lexer {
    constructor(source) {
        const startOfFileToken = new ast_ts_1.Token(tokenKind_ts_1.TokenKind.SOF, 0, 0, 0, 0);
        this.source = source;
        this.lastToken = startOfFileToken;
        this.token = startOfFileToken;
        this.line = 1;
        this.lineStart = 0;
        this._maxComments = undefined;
        this._commentCount = 0;
    }
    get [Symbol.toStringTag]() {
        return 'Lexer';
    }
    advance() {
        this.lastToken = this.token;
        const token = (this.token = this.lookahead());
        return token;
    }
    lookahead() {
        let token = this.token;
        if (token.kind !== tokenKind_ts_1.TokenKind.EOF) {
            do {
                if (token.next) {
                    token = token.next;
                }
                else {
                    const nextToken = readNextToken(this, token.end);
                    token.next = nextToken;
                    nextToken.prev = token;
                    token = nextToken;
                }
            } while (token.kind === tokenKind_ts_1.TokenKind.COMMENT);
        }
        return token;
    }
}
exports.Lexer = Lexer;
function isPunctuatorTokenKind(kind) {
    return (kind === tokenKind_ts_1.TokenKind.BANG ||
        kind === tokenKind_ts_1.TokenKind.DOLLAR ||
        kind === tokenKind_ts_1.TokenKind.AMP ||
        kind === tokenKind_ts_1.TokenKind.PAREN_L ||
        kind === tokenKind_ts_1.TokenKind.PAREN_R ||
        kind === tokenKind_ts_1.TokenKind.DOT ||
        kind === tokenKind_ts_1.TokenKind.SPREAD ||
        kind === tokenKind_ts_1.TokenKind.COLON ||
        kind === tokenKind_ts_1.TokenKind.EQUALS ||
        kind === tokenKind_ts_1.TokenKind.AT ||
        kind === tokenKind_ts_1.TokenKind.BRACKET_L ||
        kind === tokenKind_ts_1.TokenKind.BRACKET_R ||
        kind === tokenKind_ts_1.TokenKind.BRACE_L ||
        kind === tokenKind_ts_1.TokenKind.PIPE ||
        kind === tokenKind_ts_1.TokenKind.BRACE_R);
}
function isUnicodeScalarValue(code) {
    return ((code >= 0x0000 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0x10ffff));
}
function isSupplementaryCodePoint(body, location) {
    return (isLeadingSurrogate(body.charCodeAt(location)) &&
        isTrailingSurrogate(body.charCodeAt(location + 1)));
}
function isLeadingSurrogate(code) {
    return code >= 0xd800 && code <= 0xdbff;
}
function isTrailingSurrogate(code) {
    return code >= 0xdc00 && code <= 0xdfff;
}
function printCodePointAt(lexer, location) {
    const code = lexer.source.body.codePointAt(location);
    if (code === undefined) {
        return tokenKind_ts_1.TokenKind.EOF;
    }
    else if (code >= 0x0020 && code <= 0x007e) {
        const char = String.fromCodePoint(code);
        return char === '"' ? "'\"'" : `"${char}"`;
    }
    return 'U+' + code.toString(16).toUpperCase().padStart(4, '0');
}
function createToken(lexer, kind, start, end, value) {
    const line = lexer.line;
    const col = 1 + start - lexer.lineStart;
    return new ast_ts_1.Token(kind, start, end, line, col, value);
}
function readNextToken(lexer, start) {
    const body = lexer.source.body;
    const bodyLength = body.length;
    let position = start;
    while (position < bodyLength) {
        const code = body.charCodeAt(position);
        switch (code) {
            case 0xfeff:
            case 0x0009:
            case 0x0020:
            case 0x002c:
                ++position;
                continue;
            case 0x000a:
                ++position;
                ++lexer.line;
                lexer.lineStart = position;
                continue;
            case 0x000d:
                if (body.charCodeAt(position + 1) === 0x000a) {
                    position += 2;
                }
                else {
                    ++position;
                }
                ++lexer.line;
                lexer.lineStart = position;
                continue;
            case 0x0023:
                return readComment(lexer, position);
            case 0x0021:
                return createToken(lexer, tokenKind_ts_1.TokenKind.BANG, position, position + 1);
            case 0x0024:
                return createToken(lexer, tokenKind_ts_1.TokenKind.DOLLAR, position, position + 1);
            case 0x0026:
                return createToken(lexer, tokenKind_ts_1.TokenKind.AMP, position, position + 1);
            case 0x0028:
                return createToken(lexer, tokenKind_ts_1.TokenKind.PAREN_L, position, position + 1);
            case 0x0029:
                return createToken(lexer, tokenKind_ts_1.TokenKind.PAREN_R, position, position + 1);
            case 0x002e: {
                const nextCode = body.charCodeAt(position + 1);
                if (nextCode === 0x002e && body.charCodeAt(position + 2) === 0x002e) {
                    return createToken(lexer, tokenKind_ts_1.TokenKind.SPREAD, position, position + 3);
                }
                if (nextCode === 0x002e) {
                    throw (0, syntaxError_ts_1.syntaxError)(lexer.source, position, 'Unexpected "..", did you mean "..."?');
                }
                else if ((0, characterClasses_ts_1.isDigit)(nextCode)) {
                    const digits = lexer.source.body.slice(position + 1, readDigits(lexer, position + 1, nextCode));
                    throw (0, syntaxError_ts_1.syntaxError)(lexer.source, position, `Invalid number, expected digit before ".", did you mean "0.${digits}"?`);
                }
                break;
            }
            case 0x003a:
                return createToken(lexer, tokenKind_ts_1.TokenKind.COLON, position, position + 1);
            case 0x003d:
                return createToken(lexer, tokenKind_ts_1.TokenKind.EQUALS, position, position + 1);
            case 0x0040:
                return createToken(lexer, tokenKind_ts_1.TokenKind.AT, position, position + 1);
            case 0x005b:
                return createToken(lexer, tokenKind_ts_1.TokenKind.BRACKET_L, position, position + 1);
            case 0x005d:
                return createToken(lexer, tokenKind_ts_1.TokenKind.BRACKET_R, position, position + 1);
            case 0x007b:
                return createToken(lexer, tokenKind_ts_1.TokenKind.BRACE_L, position, position + 1);
            case 0x007c:
                return createToken(lexer, tokenKind_ts_1.TokenKind.PIPE, position, position + 1);
            case 0x007d:
                return createToken(lexer, tokenKind_ts_1.TokenKind.BRACE_R, position, position + 1);
            case 0x0022:
                if (body.charCodeAt(position + 1) === 0x0022 &&
                    body.charCodeAt(position + 2) === 0x0022) {
                    return readBlockString(lexer, position);
                }
                return readString(lexer, position);
        }
        if ((0, characterClasses_ts_1.isDigit)(code) || code === 0x002d) {
            return readNumber(lexer, position, code);
        }
        if ((0, characterClasses_ts_1.isNameStart)(code)) {
            return readName(lexer, position);
        }
        throw (0, syntaxError_ts_1.syntaxError)(lexer.source, position, code === 0x0027
            ? 'Unexpected single quote character (\'), did you mean to use a double quote (")?'
            : isUnicodeScalarValue(code) || isSupplementaryCodePoint(body, position)
                ? `Unexpected character: ${printCodePointAt(lexer, position)}.`
                : `Invalid character: ${printCodePointAt(lexer, position)}.`);
    }
    return createToken(lexer, tokenKind_ts_1.TokenKind.EOF, bodyLength, bodyLength);
}
function readComment(lexer, start) {
    const maxComments = lexer._maxComments;
    if (maxComments !== undefined) {
        const nextCommentCount = lexer._commentCount + 1;
        if (nextCommentCount > maxComments) {
            throw (0, syntaxError_ts_1.syntaxError)(lexer.source, start, `Document contains more than ${maxComments} comments. Parsing aborted.`);
        }
        lexer._commentCount = nextCommentCount;
    }
    const body = lexer.source.body;
    const bodyLength = body.length;
    let position = start + 1;
    while (position < bodyLength) {
        const code = body.charCodeAt(position);
        if (code === 0x000a || code === 0x000d) {
            break;
        }
        if (isUnicodeScalarValue(code)) {
            ++position;
        }
        else if (isSupplementaryCodePoint(body, position)) {
            position += 2;
        }
        else {
            break;
        }
    }
    return createToken(lexer, tokenKind_ts_1.TokenKind.COMMENT, start, position, body.slice(start + 1, position));
}
function readNumber(lexer, start, firstCode) {
    const body = lexer.source.body;
    let position = start;
    let code = firstCode;
    let isFloat = false;
    if (code === 0x002d) {
        code = body.charCodeAt(++position);
    }
    if (code === 0x0030) {
        code = body.charCodeAt(++position);
        if ((0, characterClasses_ts_1.isDigit)(code)) {
            throw (0, syntaxError_ts_1.syntaxError)(lexer.source, position, `Invalid number, unexpected digit after 0: ${printCodePointAt(lexer, position)}.`);
        }
    }
    else {
        position = readDigits(lexer, position, code);
        code = body.charCodeAt(position);
    }
    if (code === 0x002e) {
        isFloat = true;
        code = body.charCodeAt(++position);
        position = readDigits(lexer, position, code);
        code = body.charCodeAt(position);
    }
    if (code === 0x0045 || code === 0x0065) {
        isFloat = true;
        code = body.charCodeAt(++position);
        if (code === 0x002b || code === 0x002d) {
            code = body.charCodeAt(++position);
        }
        position = readDigits(lexer, position, code);
        code = body.charCodeAt(position);
    }
    if (code === 0x002e || (0, characterClasses_ts_1.isNameStart)(code)) {
        throw (0, syntaxError_ts_1.syntaxError)(lexer.source, position, `Invalid number, expected digit but got: ${printCodePointAt(lexer, position)}.`);
    }
    return createToken(lexer, isFloat ? tokenKind_ts_1.TokenKind.FLOAT : tokenKind_ts_1.TokenKind.INT, start, position, body.slice(start, position));
}
function readDigits(lexer, start, firstCode) {
    if (!(0, characterClasses_ts_1.isDigit)(firstCode)) {
        throw (0, syntaxError_ts_1.syntaxError)(lexer.source, start, `Invalid number, expected digit but got: ${printCodePointAt(lexer, start)}.`);
    }
    const body = lexer.source.body;
    let position = start + 1;
    while ((0, characterClasses_ts_1.isDigit)(body.charCodeAt(position))) {
        ++position;
    }
    return position;
}
function readString(lexer, start) {
    const body = lexer.source.body;
    const bodyLength = body.length;
    let position = start + 1;
    let chunkStart = position;
    let value = '';
    while (position < bodyLength) {
        const code = body.charCodeAt(position);
        if (code === 0x0022) {
            value += body.slice(chunkStart, position);
            return createToken(lexer, tokenKind_ts_1.TokenKind.STRING, start, position + 1, value);
        }
        if (code === 0x005c) {
            value += body.slice(chunkStart, position);
            const escape = body.charCodeAt(position + 1) === 0x0075
                ? body.charCodeAt(position + 2) === 0x007b
                    ? readEscapedUnicodeVariableWidth(lexer, position)
                    : readEscapedUnicodeFixedWidth(lexer, position)
                : readEscapedCharacter(lexer, position);
            value += escape.value;
            position += escape.size;
            chunkStart = position;
            continue;
        }
        if (code === 0x000a || code === 0x000d) {
            break;
        }
        if (isUnicodeScalarValue(code)) {
            ++position;
        }
        else if (isSupplementaryCodePoint(body, position)) {
            position += 2;
        }
        else {
            throw (0, syntaxError_ts_1.syntaxError)(lexer.source, position, `Invalid character within String: ${printCodePointAt(lexer, position)}.`);
        }
    }
    throw (0, syntaxError_ts_1.syntaxError)(lexer.source, position, 'Unterminated string.');
}
function readEscapedUnicodeVariableWidth(lexer, position) {
    const body = lexer.source.body;
    let point = 0;
    let size = 3;
    while (size < 12) {
        const code = body.charCodeAt(position + size++);
        if (code === 0x007d) {
            if (size < 5 || !isUnicodeScalarValue(point)) {
                break;
            }
            return { value: String.fromCodePoint(point), size };
        }
        point = (point << 4) | readHexDigit(code);
        if (point < 0) {
            break;
        }
    }
    throw (0, syntaxError_ts_1.syntaxError)(lexer.source, position, `Invalid Unicode escape sequence: "${body.slice(position, position + size)}".`);
}
function readEscapedUnicodeFixedWidth(lexer, position) {
    const body = lexer.source.body;
    const code = read16BitHexCode(body, position + 2);
    if (isUnicodeScalarValue(code)) {
        return { value: String.fromCodePoint(code), size: 6 };
    }
    if (isLeadingSurrogate(code)) {
        if (body.charCodeAt(position + 6) === 0x005c &&
            body.charCodeAt(position + 7) === 0x0075) {
            const trailingCode = read16BitHexCode(body, position + 8);
            if (isTrailingSurrogate(trailingCode)) {
                return { value: String.fromCodePoint(code, trailingCode), size: 12 };
            }
        }
    }
    throw (0, syntaxError_ts_1.syntaxError)(lexer.source, position, `Invalid Unicode escape sequence: "${body.slice(position, position + 6)}".`);
}
function read16BitHexCode(body, position) {
    return ((readHexDigit(body.charCodeAt(position)) << 12) |
        (readHexDigit(body.charCodeAt(position + 1)) << 8) |
        (readHexDigit(body.charCodeAt(position + 2)) << 4) |
        readHexDigit(body.charCodeAt(position + 3)));
}
function readHexDigit(code) {
    return code >= 0x0030 && code <= 0x0039
        ? code - 0x0030
        : code >= 0x0041 && code <= 0x0046
            ? code - 0x0037
            : code >= 0x0061 && code <= 0x0066
                ? code - 0x0057
                : -1;
}
function readEscapedCharacter(lexer, position) {
    const body = lexer.source.body;
    const code = body.charCodeAt(position + 1);
    switch (code) {
        case 0x0022:
            return { value: '\u0022', size: 2 };
        case 0x005c:
            return { value: '\u005c', size: 2 };
        case 0x002f:
            return { value: '\u002f', size: 2 };
        case 0x0062:
            return { value: '\u0008', size: 2 };
        case 0x0066:
            return { value: '\u000c', size: 2 };
        case 0x006e:
            return { value: '\u000a', size: 2 };
        case 0x0072:
            return { value: '\u000d', size: 2 };
        case 0x0074:
            return { value: '\u0009', size: 2 };
    }
    throw (0, syntaxError_ts_1.syntaxError)(lexer.source, position, `Invalid character escape sequence: "${body.slice(position, position + 2)}".`);
}
function readBlockString(lexer, start) {
    const body = lexer.source.body;
    const bodyLength = body.length;
    let lineStart = lexer.lineStart;
    let position = start + 3;
    let chunkStart = position;
    let currentLine = '';
    const blockLines = [];
    while (position < bodyLength) {
        const code = body.charCodeAt(position);
        if (code === 0x0022 &&
            body.charCodeAt(position + 1) === 0x0022 &&
            body.charCodeAt(position + 2) === 0x0022) {
            currentLine += body.slice(chunkStart, position);
            blockLines.push(currentLine);
            const token = createToken(lexer, tokenKind_ts_1.TokenKind.BLOCK_STRING, start, position + 3, (0, blockString_ts_1.dedentBlockStringLines)(blockLines).join('\n'));
            lexer.line += blockLines.length - 1;
            lexer.lineStart = lineStart;
            return token;
        }
        if (code === 0x005c &&
            body.charCodeAt(position + 1) === 0x0022 &&
            body.charCodeAt(position + 2) === 0x0022 &&
            body.charCodeAt(position + 3) === 0x0022) {
            currentLine += body.slice(chunkStart, position);
            chunkStart = position + 1;
            position += 4;
            continue;
        }
        if (code === 0x000a || code === 0x000d) {
            currentLine += body.slice(chunkStart, position);
            blockLines.push(currentLine);
            if (code === 0x000d && body.charCodeAt(position + 1) === 0x000a) {
                position += 2;
            }
            else {
                ++position;
            }
            currentLine = '';
            chunkStart = position;
            lineStart = position;
            continue;
        }
        if (isUnicodeScalarValue(code)) {
            ++position;
        }
        else if (isSupplementaryCodePoint(body, position)) {
            position += 2;
        }
        else {
            throw (0, syntaxError_ts_1.syntaxError)(lexer.source, position, `Invalid character within String: ${printCodePointAt(lexer, position)}.`);
        }
    }
    throw (0, syntaxError_ts_1.syntaxError)(lexer.source, position, 'Unterminated string.');
}
function readName(lexer, start) {
    const body = lexer.source.body;
    const bodyLength = body.length;
    let position = start + 1;
    while (position < bodyLength) {
        const code = body.charCodeAt(position);
        if ((0, characterClasses_ts_1.isNameContinue)(code)) {
            ++position;
        }
        else {
            break;
        }
    }
    return createToken(lexer, tokenKind_ts_1.TokenKind.NAME, start, position, body.slice(start, position));
}
//# sourceMappingURL=lexer.js.map