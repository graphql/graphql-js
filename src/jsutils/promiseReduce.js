/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import isPromise from './isPromise';
import type { MaybePromise } from './MaybePromise';

/**
 * Similar to Array.prototype.reduce(), however the reducing callback may return
 * a Promise, in which case reduction will continue after each promise resolves.
 *
 * If the callback does not return a Promise, then this function will also not
 * return a Promise.
 */
export default function promiseReduce<T, U>(
  values: $ReadOnlyArray<T>,
  callback: (U, T) => MaybePromise<U>,
  initialValue: MaybePromise<U>,
): MaybePromise<U> {
  return values.reduce(
    (previous, value) =>
      isPromise(previous)
        ? previous.then(resolved => callback(resolved, value))
        : callback(previous, value),
    initialValue,
  );
}
