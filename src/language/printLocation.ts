import { invariant } from '../jsutils/invariant.js';

import type { Location } from './ast.js';
import type { SourceLocation } from './location.js';
import { getLocation } from './location.js';
import type { Source } from './source.js';

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
  if (locationLine !== undefined && locationLine.length > 120) {
    const subLineIndex = Math.floor(columnNum / 80);
    const subLineColumnNum = columnNum % 80;
    const subLines: Array<string> = [];
    for (let i = 0; i < locationLine.length; i += 80) {
      subLines.push(locationLine.slice(i, i + 80));
    }

    const firstSubLine = subLines[0];
    const nextSubLines = subLines.slice(1, subLineIndex + 1);
    const nextSubLine = subLines[subLineIndex + 1];

    invariant(firstSubLine !== undefined);
    // invariant(nextSubLine !== undefined);

    return (
      locationStr +
      printPrefixedLines([
        [`${lineNum} |`, firstSubLine],
        ...nextSubLines.map<[string, string]>((subLine) => ['|', subLine]),
        ['|', '^'.padStart(subLineColumnNum)],
        // TODO: This assertion can be removed if the above invariant is comment in.
        ['|', nextSubLine as string],
      ])
    );
  }

  const previousLine = lines[lineIndex - 1];
  const nextLine = lines[lineIndex + 1];

  // TODO: With the way the types are set up, we should be able to
  // comment these in, but doing so breaks tests.
  //
  // invariant(previousLine !== undefined);
  // invariant(nextLine !== undefined);
  invariant(locationLine !== undefined);

  return (
    locationStr +
    printPrefixedLines([
      // Lines specified like this: ["prefix", "string"],
      // TODO: This assertion can be removed if the above invariant is comment in.
      [`${lineNum - 1} |`, previousLine as string],
      [`${lineNum} |`, locationLine],
      ['|', '^'.padStart(columnNum)],
      // TODO: This assertion can be removed if the above invariant is comment in.
      [`${lineNum + 1} |`, nextLine as string],
    ])
  );
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
