/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import getPromise from './getPromise';
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
  return values.reduce((previous, value) => {
    const promise = getPromise(previous);
    if (promise) {
      return promise.then(resolved => callback(resolved, value));
    }
    // Previous is not Promise<U>, so it is U.
    return callback((previous: any), value);
  }, initialValue);
}
