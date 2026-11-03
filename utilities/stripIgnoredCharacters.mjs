import { printBlockString } from "../language/blockString.mjs";
import { isPunctuatorTokenKind, Lexer } from "../language/lexer.mjs";
import { isSource, Source } from "../language/source.mjs";
import { TokenKind } from "../language/tokenKind.mjs";
export function stripIgnoredCharacters(source) {
    const sourceObj = isSource(source) ? source : new Source(source);
    const body = sourceObj.body;
    const lexer = new Lexer(sourceObj);
    let strippedBody = '';
    let wasLastAddedTokenNonPunctuator = false;
    while (lexer.advance().kind !== TokenKind.EOF) {
        const currentToken = lexer.token;
        const tokenKind = currentToken.kind;
        const isNonPunctuator = !isPunctuatorTokenKind(currentToken.kind);
        if (wasLastAddedTokenNonPunctuator) {
            if (isNonPunctuator || currentToken.kind === TokenKind.SPREAD) {
                strippedBody += ' ';
            }
        }
        const tokenBody = body.slice(currentToken.start, currentToken.end);
        if (tokenKind === TokenKind.BLOCK_STRING) {
            strippedBody += printBlockString(currentToken.value, { minimize: true });
        }
        else {
            strippedBody += tokenBody;
        }
        wasLastAddedTokenNonPunctuator = isNonPunctuator;
    }
    return strippedBody;
}
//# sourceMappingURL=stripIgnoredCharacters.mjs.map