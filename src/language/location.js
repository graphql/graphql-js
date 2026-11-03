import type { Source } from './source';

/**
 * Represents a location in a Source.
 */
export type SourceLocation = {|
  +line: number,
  +column: number,
|};

/**
 * Takes a Source and a UTF-8 character offset, and returns the corresponding
 * line and column as a SourceLocation.
 */
export function getLocation(source: Source, position: number): SourceLocation {
  return getLocations([{ source, start: position }])[0];
}

/** @internal */
export function getLocations(
  locations: $ReadOnlyArray<{ +source: Source, +start: number, ... }>,
): Array<SourceLocation> {
  const bySource: Map<
    Source,
    Array<{| position: number, index: number |}>,
  > = new Map();
  locations.forEach(({ source, start }, index) => {
    let positions = bySource.get(source);
    if (positions === undefined) {
      positions = [];
      bySource.set(source, positions);
    }
    positions.push({ position: start, index });
  });
  const result: Array<SourceLocation> = new Array(locations.length);
  for (const [source, positions] of Array.from(bySource)) {
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
