/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { getLocation } from './location';
import type { Source } from './source';

export function error(
  source: Source,
  position: number,
  description: string
): Error {
  var location = getLocation(source, position);
  var syntaxError: any = new Error(
    `Syntax Error ${source.name} (${location.line}:${location.column}) ` +
    description + '\n\n' + highlightSourceAtLocation(source, location)
  );
  syntaxError.source = source;
  syntaxError.position = position;
  syntaxError.location = location;
  return syntaxError;
}

function highlightSourceAtLocation(source, location) {
  var line = location.line;
  var prevLineNum = (line - 1).toString();
  var lineNum = line.toString();
  var nextLineNum = (line + 1).toString();
  var padLen = nextLineNum.length;
  var lines = source.body.split(/\r\n|[\n\r\u2028\u2029]/g);
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
