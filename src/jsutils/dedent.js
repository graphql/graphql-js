/* @flow */
/**
 *  Copyright (c) 2017, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import removeIndentation from './removeIndentation';

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
  strings: string | { raw: [string]},
  ...values: Array<string>
) {
  const raw = typeof strings === 'string' ? [ strings ] : strings.raw;
  let res = '';
  // interpolation
  for (let i = 0; i < raw.length; i++) {
    res += raw[i].replace(/\\`/g, '`'); // handle escaped backticks

    if (i < values.length) {
      res += values[i];
    }
  }

  return removeIndentation(res) + '\n';
}
