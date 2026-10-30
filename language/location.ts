/** @category Source */
import { AccumulatorMap } from '../jsutils/AccumulatorMap.ts';
import type { Source } from './source.ts';
const LineRegExp = /\r\n|[\n\r]/g;
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
  const matches = source.body.matchAll(LineRegExp);
  let match = matches.next().value;
  let line = 1;
  let lastLineStart = 0;
  while (match !== undefined && match.index < position) {
    lastLineStart = match.index + match[0].length;
    line++;
    match = matches.next().value;
  }
  return { line, column: position + 1 - lastLineStart };
}
/** @internal */
export function getLocations(
  locations: ReadonlyArray<{
    source: Source;
    start: number;
  }>,
): Array<SourceLocation> {
  if (locations.length < 2) {
    return locations.map(({ source, start }) => getLocation(source, start));
  }
  const bySource = new AccumulatorMap<
    Source,
    {
      position: number;
      index: number;
    }
  >();
  locations.forEach(({ source, start }, index) => {
    bySource.add(source, {
      position: start,
      index,
    });
  });
  const result = new Array<SourceLocation>(locations.length);
  for (const [source, positions] of bySource) {
    const matches = source.body.matchAll(LineRegExp);
    let match = matches.next().value;
    let line = 1;
    let lastLineStart = 0;
    for (const { position, index } of positions.toSorted(
      (a, b) => a.position - b.position,
    )) {
      while (match !== undefined && match.index < position) {
        lastLineStart = match.index + match[0].length;
        line++;
        match = matches.next().value;
      }
      result[index] = {
        line,
        column: position + 1 - lastLineStart,
      };
    }
  }
  return result;
}
