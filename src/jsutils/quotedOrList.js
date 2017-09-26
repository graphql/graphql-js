/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
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
