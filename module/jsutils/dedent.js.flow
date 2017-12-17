/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

/**
 * fixes identation by removing leading spaces from each line
 */
function fixIdent(str: string): string {
  const indent = /^\n?( *)/.exec(str)[1]; // figure out ident
  return str
    .replace(RegExp('^' + indent, 'mg'), '') // remove ident
    .replace(/^\n*/m, '') //  remove leading newline
    .replace(/ *$/, ''); // remove trailing spaces
}

/**
 * An ES6 string tag that fixes identation. Also removes leading newlines
 * but keeps trailing ones
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
  strings: string | { raw: [string] },
  ...values: Array<string>
) {
  const raw = typeof strings === 'string' ? [strings] : strings.raw;
  let res = '';
  // interpolation
  for (let i = 0; i < raw.length; i++) {
    res += raw[i].replace(/\\`/g, '`'); // handle escaped backticks

    if (i < values.length) {
      res += values[i];
    }
  }

  return fixIdent(res);
}
