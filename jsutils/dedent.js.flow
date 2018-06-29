/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import invariant from './invariant';

/**
 * fixes indentation by removing leading spaces and tabs from each line
 */
function fixIndent(str: string): string {
  const trimmedStr = str
    .replace(/^\n*/m, '') //  remove leading newline
    .replace(/[ \t]*$/, ''); // remove trailing spaces and tabs
  const indentMatch = /^[ \t]*/.exec(trimmedStr);
  invariant(Array.isArray(indentMatch));
  const indent = indentMatch[0]; // figure out indent
  return trimmedStr.replace(RegExp('^' + indent, 'mg'), ''); // remove indent
}

/**
 * An ES6 string tag that fixes indentation. Also removes leading newlines
 * and trailing spaces and tabs, but keeps trailing newlines.
 *
 * Example usage:
 * const str = dedent`
 *   {
 *     test
 *   }
 * `
 * str === "{\n  test\n}\n";
 */
export default function dedent(
  strings: string | Array<string>,
  ...values: Array<string>
): string {
  // when used as an ordinary function, allow passing a singleton string
  const strArray = typeof strings === 'string' ? [strings] : strings;
  const numValues = values.length;

  const str = strArray.reduce((prev, cur, index) => {
    let next = prev + cur;
    if (index < numValues) {
      next += values[index]; // interpolation
    }
    return next;
  }, '');

  return fixIndent(str);
}
