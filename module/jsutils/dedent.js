/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

/**
 * fixes indentation by removing leading spaces from each line
 */
function fixIndent(str) {
  var indent = /^\n?( *)/.exec(str)[1]; // figure out indent
  return str.replace(RegExp('^' + indent, 'mg'), '') // remove indent
  .replace(/^\n*/m, '') //  remove leading newline
  .replace(/ *$/, ''); // remove trailing spaces
}

/**
 * An ES6 string tag that fixes indentation. Also removes leading newlines
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
export default function dedent(strings) {
  var raw = typeof strings === 'string' ? [strings] : strings.raw;
  var res = '';
  // interpolation
  for (var i = 0; i < raw.length; i++) {
    res += raw[i].replace(/\\`/g, '`'); // handle escaped backticks

    if (i < (arguments.length <= 1 ? 0 : arguments.length - 1)) {
      res += arguments.length <= i + 1 ? undefined : arguments[i + 1];
    }
  }

  return fixIndent(res);
}