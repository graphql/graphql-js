/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

/**
 * Produces the value of a block string from its parsed raw value, similar to
 * Coffeescript's block string, Python's docstring trim or Ruby's strip_heredoc.
 *
 * This implements the GraphQL spec's BlockStringValue() static algorithm.
 */
export default function blockStringValue(rawString: string): string {
  // Expand a block string's raw value into independent lines.
  const lines = rawString.split(/\r\n|[\n\r]/g);

  // Remove common indentation from all lines but first.
  let commonIndent = null;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const indent = leadingWhitespace(line);
    if (
      indent < line.length &&
      (commonIndent === null || indent < commonIndent)
    ) {
      commonIndent = indent;
      if (commonIndent === 0) {
        break;
      }
    }
  }

  if (commonIndent) {
    for (let i = 1; i < lines.length; i++) {
      lines[i] = lines[i].slice(commonIndent);
    }
  }

  // Remove leading and trailing blank lines.
  while (lines.length > 0 && isBlank(lines[0])) {
    lines.shift();
  }
  while (lines.length > 0 && isBlank(lines[lines.length - 1])) {
    lines.pop();
  }

  // Return a string of the lines joined with U+000A.
  return lines.join('\n');
}

function leadingWhitespace(str) {
  let i = 0;
  while (i < str.length && (str[i] === ' ' || str[i] === '\t')) {
    i++;
  }
  return i;
}

function isBlank(str) {
  return leadingWhitespace(str) === str.length;
}
