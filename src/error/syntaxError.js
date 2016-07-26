/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { getLocation } from '../language/location';
import type { Source } from '../language/source';
import { GraphQLError } from './GraphQLError';

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
  const error = new GraphQLError(
    `Syntax Error ${source.name} (${location.line}:${location.column}) ` +
    description + '\n\n' + highlightSourceAtLocation(source, location),
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
  const prevLineNum = (line - 1).toString();
  const lineNum = line.toString();
  const nextLineNum = (line + 1).toString();
  const padLen = nextLineNum.length;
  const lines = source.body.split(/\r\n|[\n\r]/g);
  return (
    (line >= 2 ?
      lpad(padLen, prevLineNum) + ': ' + lines[line - 2] + '\n' : '') +
    lpad(padLen, lineNum) + ': ' + lines[line - 1] + '\n' +
    Array(2 + padLen + location.column).join(' ') + '^\n' +
    (line < lines.length ?
      lpad(padLen, nextLineNum) + ': ' + lines[line] + '\n' : '')
  );
}

function lpad(len, str) {
  return Array(len - str.length + 1).join(' ') + str;
}
