

// eslint-disable-next-line no-redeclare
export default function isPromise(value) {
  return Boolean(value && typeof value.then === 'function');
} /**
   * Copyright (c) 2015-present, Facebook, Inc.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   *  strict
   */

/**
 * Returns true if the value acts like a Promise, i.e. has a "then" function,
 * otherwise returns false.
 */