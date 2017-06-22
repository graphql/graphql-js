/* @flow */
/**
 *  Copyright (c) 2017, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

/**
 * Removes leading identation from each line in a multi-line string.
 *
 * This implements RemoveIndentation() algorithm in the GraphQL spec.
 *
 * Note: this is similar to Python's docstring "trim" operation.
 * https://www.python.org/dev/peps/pep-0257/#handling-docstring-indentation
 */
export default function removeIndentation(rawString: string): string {
  // Expand a multi-line string into independent lines.
  const lines = rawString.split(/\r\n|[\n\r]/g);

  // Determine minimum indentation, not including the first line.
  let minIndent;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const lineIndent = leadingWhitespace(line);
    if (
      lineIndent < line.length &&
      (minIndent === undefined || lineIndent < minIndent)
    ) {
      minIndent = lineIndent;
      if (minIndent === 0) {
        break;
      }
    }
  }

  // Remove indentation, not including the first line.
  if (minIndent) {
    for (let i = 1; i < lines.length; i++) {
      lines[i] = lines[i].slice(minIndent);
    }
  }

  // Remove leading and trailing empty lines.
  while (lines.length > 0 && lines[0].length === 0) {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1].length === 0) {
    lines.pop();
  }

  // Return a multi-line string joined with U+000A.
  return lines.join('\n');
}

function leadingWhitespace(str) {
  let i = 0;
  for (; i < str.length; i++) {
    if (str[i] !== ' ' && str[i] !== '\t') {
      break;
    }
  }
  return i;
}
