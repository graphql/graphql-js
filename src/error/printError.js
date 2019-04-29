/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { type SourceLocation, getLocation } from '../language/location';
import { type Source } from '../language/source';
import { type GraphQLError } from './GraphQLError';

/**
 * Prints a GraphQLError to a string, representing useful location information
 * about the error's position in the source.
 */
export function printError(error: GraphQLError): string {
  const printedLocations = [];
  if (error.nodes) {
    for (const node of error.nodes) {
      if (node.loc) {
        printedLocations.push(
          highlightSourceAtLocation(
            node.loc.source,
            getLocation(node.loc.source, node.loc.start),
          ),
        );
      }
    }
  } else if (error.source && error.locations) {
    const source = error.source;
    for (const location of error.locations) {
      printedLocations.push(highlightSourceAtLocation(source, location));
    }
  }
  return printedLocations.length === 0
    ? error.message
    : [error.message, ...printedLocations].join('\n\n') + '\n';
}

/**
 * Render a helpful description of the location of the error in the GraphQL
 * Source document.
 */
function highlightSourceAtLocation(
  source: Source,
  location: SourceLocation,
): string {
  const firstLineColumnOffset = source.locationOffset.column - 1;
  const body = whitespace(firstLineColumnOffset) + source.body;

  const lineIndex = location.line - 1;
  const lineOffset = source.locationOffset.line - 1;
  const lineNum = location.line + lineOffset;

  const columnOffset = location.line === 1 ? firstLineColumnOffset : 0;
  const columnNum = location.column + columnOffset;

  const lines = body.split(/\r\n|[\n\r]/g);
  return (
    `${source.name} (${lineNum}:${columnNum})\n` +
    printPrefixedLines([
      // Lines specified like this: ["prefix", "string"],
      [`${lineNum - 1}: `, lines[lineIndex - 1]],
      [`${lineNum}: `, lines[lineIndex]],
      ['', whitespace(columnNum - 1) + '^'],
      [`${lineNum + 1}: `, lines[lineIndex + 1]],
    ])
  );
}

function printPrefixedLines(lines: Array<[string, string]>): string {
  const existingLines = lines.filter(([_, line]) => line !== undefined);

  let padLen = 0;
  for (const [prefix] of existingLines) {
    padLen = Math.max(padLen, prefix.length);
  }

  return existingLines
    .map(([prefix, line]) => lpad(padLen, prefix) + line)
    .join('\n');
}

function whitespace(len: number): string {
  return Array(len + 1).join(' ');
}

function lpad(len: number, str: string): string {
  return whitespace(len - str.length) + str;
}
