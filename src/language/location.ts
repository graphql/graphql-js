/** @category Source */

import type { Source } from './source';

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
export function getLocation(source: Source, position: number): SourceLocation {
  const lineRegexp = /\r\n|[\n\r]/g;
  let line = 1;
  let column = position + 1;
  let match;
  while ((match = lineRegexp.exec(source.body)) && match.index < position) {
    line++;
    column = position + 1 - (match.index + match[0].length);
  }
  return { line, column };
}

/** @internal */
export function getLocations(
  locations: ReadonlyArray<{ source: Source; start: number }>,
): Array<SourceLocation> {
  if (locations.length < 2) {
    return locations.map(({ source, start }) => getLocation(source, start));
  }
  const bySource = new Map<
    Source,
    Array<{ position: number; index: number }>
  >();
  locations.forEach(({ source, start }, index) => {
    let positions = bySource.get(source);
    if (positions === undefined) {
      positions = [];
      bySource.set(source, positions);
    }
    positions.push({ position: start, index });
  });
  const result = new Array<SourceLocation>(locations.length);
  for (const [source, positions] of bySource) {
    const lineRegexp = /\r\n|[\n\r]/g;
    let match = lineRegexp.exec(source.body);
    let line = 1;
    let lastLineStart = 0;
    // These arrays are local; sorting never changes the caller's input.
    positions.sort((a, b) => a.position - b.position);
    for (const { position, index } of positions) {
      while (match !== null && match.index < position) {
        lastLineStart = match.index + match[0].length;
        line++;
        match = lineRegexp.exec(source.body);
      }
      result[index] = { line, column: position + 1 - lastLineStart };
    }
  }
  return result;
}
