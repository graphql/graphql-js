import { syntaxError } from "../error/syntaxError.mjs";
import { Token } from "./ast.mjs";
import { isNameStart } from "./characterClasses.mjs";
import { createToken, printCodePointAt, readName } from "./lexer.mjs";
import { TokenKind } from "./tokenKind.mjs";
export class SchemaCoordinateLexer {
    constructor(source) {
        this.line = 1;
        this.lineStart = 0;
        const startOfFileToken = new Token(TokenKind.SOF, 0, 0, 0, 0);
        this.source = source;
        this.lastToken = startOfFileToken;
        this.token = startOfFileToken;
    }
    get [Symbol.toStringTag]() {
        return 'SchemaCoordinateLexer';
    }
    advance() {
        this.lastToken = this.token;
        const token = (this.token = this.lookahead());
        return token;
    }
    lookahead() {
        let token = this.token;
        if (token.kind !== TokenKind.EOF) {
            const nextToken = readNextToken(this, token.end);
            token.next = nextToken;
            nextToken.prev = token;
            token = nextToken;
        }
        return token;
    }
}
function readNextToken(lexer, start) {
    const body = lexer.source.body;
    const bodyLength = body.length;
    const position = start;
    if (position < bodyLength) {
        const code = body.charCodeAt(position);
        switch (code) {
            case 0x002e:
                return createToken(lexer, TokenKind.DOT, position, position + 1);
            case 0x0028:
                return createToken(lexer, TokenKind.PAREN_L, position, position + 1);
            case 0x0029:
                return createToken(lexer, TokenKind.PAREN_R, position, position + 1);
            case 0x003a:
                return createToken(lexer, TokenKind.COLON, position, position + 1);
            case 0x0040:
                return createToken(lexer, TokenKind.AT, position, position + 1);
        }
        if (isNameStart(code)) {
            return readName(lexer, position);
        }
        throw syntaxError(lexer.source, position, `Invalid character: ${printCodePointAt(lexer, position)}.`);
    }
    return createToken(lexer, TokenKind.EOF, bodyLength, bodyLength);
}
//# sourceMappingURL=schemaCoordinateLexer.mjs.map