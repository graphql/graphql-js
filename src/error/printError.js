/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type { SourceLocation } from '../language/location';
import type { Source } from '../language/source';
import type { GraphQLError } from './GraphQLError';

/**
 * Prints a GraphQLError to a string, representing useful location information
 * about the error's position in the source.
 */
export function printError(error: GraphQLError): string {
  const source = error.source;
  const locations = error.locations || [];
  const printedLocations = locations.map(
    location =>
      source
        ? highlightSourceAtLocation(source, location)
        : ` (${location.line}:${location.column})`,
  );
  return error.message + printedLocations.join('');
}

/**
 * Render a helpful description of the location of the error in the GraphQL
 * Source document.
 */
function highlightSourceAtLocation(
  source: Source,
  location: SourceLocation,
): string {
  const line = location.line;
  const lineOffset = source.locationOffset.line - 1;
  const columnOffset = getColumnOffset(source, location);
  const contextLine = line + lineOffset;
  const contextColumn = location.column + columnOffset;
  const prevLineNum = (contextLine - 1).toString();
  const lineNum = contextLine.toString();
  const nextLineNum = (contextLine + 1).toString();
  const padLen = nextLineNum.length;
  const lines = source.body.split(/\r\n|[\n\r]/g);
  lines[0] = whitespace(source.locationOffset.column - 1) + lines[0];
  return (
    `\n\n${source.name} (${contextLine}:${contextColumn})\n` +
    (line >= 2
      ? lpad(padLen, prevLineNum) + ': ' + lines[line - 2] + '\n'
      : '') +
    lpad(padLen, lineNum) +
    ': ' +
    lines[line - 1] +
    '\n' +
    whitespace(2 + padLen + contextColumn - 1) +
    '^\n' +
    (line < lines.length
      ? lpad(padLen, nextLineNum) + ': ' + lines[line] + '\n'
      : '')
  );
}

function getColumnOffset(source: Source, location: SourceLocation): number {
  return location.line === 1 ? source.locationOffset.column - 1 : 0;
}

function whitespace(len: number): string {
  return Array(len + 1).join(' ');
}

function lpad(len: number, str: string): string {
  return whitespace(len - str.length) + str;
}
