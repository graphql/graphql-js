/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

const MAX_LENGTH = 5;

/**
 * Given [ A, B, C ] return '"A", "B", or "C"'.
 */
export default function quotedOrList(items: Array<string>): string {
  const selected = items.slice(0, MAX_LENGTH);
  return selected
    .map(item => `"${item}"`)
    .reduce((list, quoted, index) =>
      list +
      (selected.length > 2 ? ', ' : ' ') +
      (index === selected.length - 1 ? 'or ' : '') +
      quoted
    );
}
