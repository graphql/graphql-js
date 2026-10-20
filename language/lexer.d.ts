/** @category Lexing */
import { Token } from "./ast.js";
import type { Source } from "./source.js";
import { TokenKind } from "./tokenKind.js";
/**
 * A Lexer interface which provides common properties and methods required for
 * lexing GraphQL source.
 *
 * @internal
 */
export interface LexerInterface {
    source: Source;
    lastToken: Token;
    token: Token;
    line: number;
    lineStart: number;
    _maxComments?: number | undefined;
    _commentCount?: number | undefined;
    advance: () => Token;
    lookahead: () => Token;
}
/**
 * Given a Source object, creates a Lexer for that source.
 * A Lexer is a stateful stream generator in that every time
 * it is advanced, it returns the next token in the Source. Assuming the
 * source lexes, the final Token emitted by the lexer will be of kind
 * EOF, after which the lexer will repeatedly return the same EOF token
 * whenever called.
 */
export declare class Lexer implements LexerInterface {
    /** Source document used to derive error locations. */
    source: Source;
    /** Most recent non-ignored token returned by the lexer. */
    lastToken: Token;
    /** Current non-ignored token at the lexer cursor. */
    token: Token;
    /** The (1-indexed) line containing the current token. */
    line: number;
    /** Character offset where the current line starts. */
    lineStart: number;
    /** @internal */
    _maxComments: number | undefined;
    /** @internal */
    _commentCount: number;
    /**
     * Creates a Lexer instance.
     * @param source - Source document used to derive error locations.
     * @example
     * ```ts
     * import { Lexer, Source, TokenKind } from 'graphql/language';
     *
     * const lexer = new Lexer(new Source('{ hello }'));
     *
     * lexer.token.kind; // => TokenKind.SOF
     * lexer.advance().kind; // => TokenKind.BRACE_L
     * lexer.advance().value; // => 'hello'
     * lexer.advance().kind; // => TokenKind.BRACE_R
     * ```
     */
    constructor(source: Source);
    /**
     * Returns the value used by `Object.prototype.toString`.
     * @returns The built-in string tag for this object.
     */
    get [Symbol.toStringTag](): string;
    /**
     * Advances the token stream to the next non-ignored token.
     * @returns The next non-ignored token.
     * @example
     * ```ts
     * import { Lexer, Source } from 'graphql/language';
     *
     * const lexer = new Lexer(new Source('{ hello }'));
     * const token = lexer.advance();
     *
     * token.kind; // => '{'
     * lexer.token; // => token
     * ```
     */
    advance(): Token;
    /**
     * Looks ahead and returns the next non-ignored token, but does not change
     * the state of Lexer.
     * @returns The next non-ignored token without advancing the lexer.
     * @example
     * ```ts
     * import { Lexer, Source } from 'graphql/language';
     *
     * const lexer = new Lexer(new Source('{ hello }'));
     * const token = lexer.lookahead();
     *
     * token.kind; // => '{'
     * lexer.token.kind; // => '<SOF>'
     * ```
     */
    lookahead(): Token;
}
/** @internal */
export declare function isPunctuatorTokenKind(kind: TokenKind): boolean;
/**
 * Prints the code point (or end of file reference) at a given location in a
 * source for use in error messages.
 *
 * Printable ASCII is printed quoted, while other points are printed in Unicode
 * code point form (ie. U+1234).
 *
 * @internal
 */
export declare function printCodePointAt(lexer: LexerInterface, location: number): string;
/**
 * Create a token with line and column location information.
 *
 * @internal
 */
export declare function createToken(lexer: LexerInterface, kind: TokenKind, start: number, end: number, value?: string): Token;
/**
 * Reads an alphanumeric + underscore name from the source.
 *
 * ```
 * Name ::
 *   - NameStart NameContinue* [lookahead != NameContinue]
 * ```
 *
 * @internal
 */
export declare function readName(lexer: LexerInterface, start: number): Token;
