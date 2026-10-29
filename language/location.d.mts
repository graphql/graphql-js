/** @category Source */
import type { Source } from "./source.mjs";
/** Represents a location in a Source. */
export interface SourceLocation {
    /** One-indexed line number in the source document. */
    readonly line: number;
    /** One-indexed column number in the source document. */
    readonly column: number;
}
/**
 * Takes a Source and a UTF-8 character offset, and returns the corresponding
 * line and column as a SourceLocation.
 * @param source - The source document that contains the position.
 * @param position - The UTF-8 character offset in the source body.
 * @returns The 1-indexed line and column for the given source position.
 * @example
 * ```ts
 * import { Source, getLocation } from 'graphql/language';
 *
 * const source = new Source('type Query { hello: String }');
 * const location = getLocation(source, 13); // => { line: 1, column: 14 }
 * ```
 */
export declare function getLocation(source: Source, position: number): SourceLocation;
/** @internal */
export declare function getLocations(locations: ReadonlyArray<{
    source: Source;
    start: number;
}>): Array<SourceLocation>;
