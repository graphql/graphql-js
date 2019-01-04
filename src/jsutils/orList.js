/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import invariant from './invariant';

const MAX_LENGTH = 5;

/**
 * Given [ A, B, C ] return 'A, B, or C'.
 */
export default function orList(items: $ReadOnlyArray<string>): string {
  invariant(items.length !== 0);

  if (items.length === 1) {
    return items[0];
  }
  if (items.length === 2) {
    return items[0] + ' or ' + items[1];
  }

  const selected = items.slice(0, MAX_LENGTH);
  const lastItem = selected.pop();
  return selected.join(', ') + ', or ' + lastItem;
}
