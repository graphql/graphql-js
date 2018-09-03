/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */
import invariant from './invariant';
/**
 * fixes indentation by removing leading spaces and tabs from each line
 */

function fixIndent(str) {
  var trimmedStr = str.replace(/^\n*/m, '') //  remove leading newline
  .replace(/[ \t]*$/, ''); // remove trailing spaces and tabs

  var indentMatch = /^[ \t]*/.exec(trimmedStr);
  !Array.isArray(indentMatch) ? invariant(0) : void 0;
  var indent = indentMatch[0]; // figure out indent

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
 * `;
 * str === "{\n  test\n}\n";
 */


export default function dedent(strings) {
  for (var _len = arguments.length, values = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    values[_key - 1] = arguments[_key];
  }

  // when used as an ordinary function, allow passing a singleton string
  var strArray = typeof strings === 'string' ? [strings] : strings;
  var numValues = values.length;
  var str = strArray.reduce(function (prev, cur, index) {
    var next = prev + cur;

    if (index < numValues) {
      next += values[index]; // interpolation
    }

    return next;
  }, '');
  return fixIndent(str);
}