/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import { getLocation } from '../language/location';
import type { Source } from '../language/source';
import { GraphQLError } from './GraphQLError';

import type {SourceLocation} from '../language/location';

/**
 * Produces a GraphQLError representing a syntax error, containing useful
 * descriptive information about the syntax error's position in the source.
 */
export function syntaxError(
  source: Source,
  position: number,
  description: string
): GraphQLError {
  const location = getLocation(source, position);
  const line = location.line + source.locationOffset.line - 1;
  const columnOffset = getColumnOffset(source, location);
  const column = location.column + columnOffset;
  const error = new GraphQLError(
    `Syntax Error ${source.name} (${line}:${column}) ${description}` +
      '\n\n' + highlightSourceAtLocation(source, location),
    undefined,
    source,
    [ position ]
  );
  return error;
}

/**
 * Render a helpful description of the location of the error in the GraphQL
 * Source document.
 */
function highlightSourceAtLocation(source, location) {
  const line = location.line;
  const lineOffset = source.locationOffset.line - 1;
  const columnOffset = getColumnOffset(source, location);
  const contextLine = line + lineOffset;
  const prevLineNum = (contextLine - 1).toString();
  const lineNum = contextLine.toString();
  const nextLineNum = (contextLine + 1).toString();
  const padLen = nextLineNum.length;
  const lines = source.body.split(/\r\n|[\n\r]/g);
  lines[0] = whitespace(source.locationOffset.column - 1) + lines[0];
  return (
    (line >= 2 ?
      lpad(padLen, prevLineNum) + ': ' + lines[line - 2] + '\n' : '') +
    lpad(padLen, lineNum) + ': ' + lines[line - 1] + '\n' +
    whitespace(2 + padLen + location.column - 1 + columnOffset) + '^\n' +
    (line < lines.length ?
      lpad(padLen, nextLineNum) + ': ' + lines[line] + '\n' : '')
  );
}

function getColumnOffset(
  source: Source,
  location: SourceLocation
): number {
  return location.line === 1 ? source.locationOffset.column - 1 : 0;
}

function whitespace(len) {
  return Array(len + 1).join(' ');
}

function lpad(len, str) {
  return whitespace(len - str.length) + str;
}
