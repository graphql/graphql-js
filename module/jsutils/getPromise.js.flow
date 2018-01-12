/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

/**
 * Only returns the value if it acts like a Promise, i.e. has a "then" function,
 * otherwise returns void.
 */
export default function getPromise<T>(
  value: Promise<T> | mixed,
): Promise<T> | void {
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof value.then === 'function'
  ) {
    return (value: any);
  }
}
