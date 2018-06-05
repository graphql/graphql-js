/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

export default function find<T>(
  list: $ReadOnlyArray<T>,
  predicate: (item: T) => boolean,
): ?T {
  for (let i = 0; i < list.length; i++) {
    if (predicate(list[i])) {
      return list[i];
    }
  }
}
