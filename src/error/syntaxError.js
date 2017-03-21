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
import type { ASTNode } from '../language/ast';

/**
 * Produces a string for formatting a syntax or validation error with an
 * embedded location.
 */
export function printLocatedError(
  source: Source,
  position: number,
  message: string,
  description?: string,
): GraphQLError {
  const location = getLocation(source, position);
  const body = `${message} (${location.line}:${location.column})` +
    (description ? ' ' + description : '') +
    '\n\n' + highlightSourceAtLocation(source, location);
  return new GraphQLError(
    body,
    undefined,
    source,
    [ position ]
  );
}

/**
 * Produces a GraphQLError representing a syntax error, containing useful
 * descriptive information about the syntax error's position in the source.
 */
export function syntaxError(
  source: Source,
  position: number,
  description: string
): GraphQLError {
  return printLocatedError(
    source,
    position,
    `Syntax Error ${source.name}`,
    description,
  );
}

/**
 * Produces a GraphQLError for the invariant(...) function that renders the
 * location where a validation error occurred. If no source is passed in, it
 * returns an error containing the message, without context.
 */
export function validationError(
  source: ?Source,
  node: ?ASTNode,
  message: string,
): GraphQLError {
  const position = node ? (node.loc ? node.loc.start : null) : null;
  if (position == null || source == null) {
    return new GraphQLError(message);
  }
  return printLocatedError(source, position, `Validation Error: ${message}`);
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
