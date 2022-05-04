import { invariant } from '../jsutils/invariant.ts';
import type { Source } from './source.ts';
const LineRegExp = /\r\n|[\n\r]/g;
/**
 * Represents a location in a Source.
 */
export interface SourceLocation {
  readonly line: number;
  readonly column: number;
}
/**
 * Takes a Source and a UTF-8 character offset, and returns the corresponding
 * line and column as a SourceLocation.
 */
export function getLocation(source: Source, position: number): SourceLocation {
  let lastLineStart = 0;
  let line = 1;
  for (const match of source.body.matchAll(LineRegExp)) {
    typeof match.index === 'number' || invariant(false);
    if (match.index >= position) {
      break;
    }
    lastLineStart = match.index + match[0].length;
    line += 1;
  }
  return { line, column: position + 1 - lastLineStart };
}
