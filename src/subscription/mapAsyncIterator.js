/**
 * Copyright (c) 2017, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import { $$asyncIterator, getAsyncIterator } from 'iterall';

/**
 * Given an AsyncIterable and a callback function, return an AsyncIterator
 * which produces values mapped via calling the callback function.
 */
export default function mapAsyncIterator<T, U>(
  iterable: AsyncIterable<T>,
  callback: (value: T) => U
): AsyncIterator<U> {
  // Fixes a temporary issue with Regenerator/Babel
  // https://github.com/facebook/regenerator/pull/290
  const iterator = iterable.next ? (iterable: any) : getAsyncIterator(iterable);

  function mapResult(result) {
    return result.done ?
      result :
      Promise.resolve(callback(result.value)).then(
        mapped => ({ value: mapped, done: false })
      );
  }

  return {
    next() {
      return iterator.next().then(mapResult);
    },
    return() {
      if (typeof iterator.return === 'function') {
        return iterator.return().then(mapResult);
      }
      return Promise.resolve({ value: undefined, done: true });
    },
    throw(error) {
      if (typeof iterator.throw === 'function') {
        return iterator.throw(error).then(mapResult);
      }
      return Promise.reject(error);
    },
    [$$asyncIterator]() {
      return this;
    },
  };
}
