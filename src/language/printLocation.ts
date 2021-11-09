import type { Source } from './source';
import type { Location } from './ast';
import type { SourceLocation } from './location';
import { getLocation } from './location';

/**
 * Render a helpful description of the location in the GraphQL Source document.
 */
export function printLocation(location: Location): string {
  return printSourceLocation(
    location.source,
    getLocation(location.source, location.start),
  );
}

/**
 * Render a helpful description of the location in the GraphQL Source document.
 */
export function printSourceLocation(
  source: Source,
  sourceLocation: SourceLocation,
  /**
   * Optional number of lines to be added before and after the original location (default: `1`).
   */
  padding: number = 1
): string {
  const firstLineColumnOffset = source.locationOffset.column - 1;
  const body = ''.padStart(firstLineColumnOffset) + source.body;

  const lineIndex = sourceLocation.line - 1;
  const lineOffset = source.locationOffset.line - 1;
  const lineNum = sourceLocation.line + lineOffset;

  const columnOffset = sourceLocation.line === 1 ? firstLineColumnOffset : 0;
  const columnNum = sourceLocation.column + columnOffset;
  const locationStr = `${source.name}:${lineNum}:${columnNum}\n`;

  const lines = body.split(/\r\n|[\n\r]/g);
  const locationLine = lines[lineIndex];

  // Special case for minified documents
  if (locationLine.length > 120) {
    const subLineIndex = Math.floor(columnNum / 80);
    const subLineColumnNum = columnNum % 80;
    const subLines: Array<string> = [];
    for (let i = 0; i < locationLine.length; i += 80) {
      subLines.push(locationLine.slice(i, i + 80));
    }

    return (
      locationStr +
      printPrefixedLines([
        [`${lineNum} |`, subLines[0]],
        ...subLines
          .slice(1, subLineIndex + 1)
          .map((subLine) => ['|', subLine] as const),
        ['|', '^'.padStart(subLineColumnNum)],
        ['|', subLines[subLineIndex + 1]],
      ])
    );
  }

  const { before, after } = generatePaddingLines(lineNum, lineIndex, lines, padding);

  return (
    locationStr +
    printPrefixedLines([
      // Lines specified like this: ["prefix", "string"],
      ...before,
      [`${lineNum} |`, locationLine],
      ['|', '^'.padStart(columnNum)],
      ...after,
    ])
  );
}

function generatePaddingLines(
  lineNum: number,
  lineIndex: number,
  lines: string[],
  margin: number
): {
  before: readonly [string, string][];
  after: readonly [string, string][];
} {
  const before: [string, string][] = [];
  const after: [string, string][] = [];

  for (let i = 1; i <= margin; i++) {
    const prevLineIndex = lineIndex - i;
    
    if (prevLineIndex >= 0) {
      before.unshift([`${lineNum - i} |`, lines[prevLineIndex]]);
    }

    const nextLineIndex = lineIndex + i;
    
    if (nextLineIndex < lines.length) {
      after.push([`${lineNum + i} |`, lines[nextLineIndex]]);
    }
  }
  
  return {
    before,
    after
  };
}

function printPrefixedLines(
  lines: ReadonlyArray<readonly [string, string]>,
): string {
  const existingLines = lines.filter(([_, line]) => line !== undefined);

  const padLen = Math.max(...existingLines.map(([prefix]) => prefix.length));
  return existingLines
    .map(([prefix, line]) => prefix.padStart(padLen) + (line ? ' ' + line : ''))
    .join('\n');
}
