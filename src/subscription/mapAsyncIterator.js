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

const ASYNC_ITERATOR_SYMBOL =
  typeof Symbol === 'function' && Symbol.asyncIterator || '@@asyncIterator';

/**
 * Given an AsyncIterator and a callback function, return a new AsyncIterator
 * which produces values mapped via calling the callback function.
 */
export default function mapAsyncIterator<T, U>(
  iterator: AsyncIterator<T>,
  callback: (value: T) => U
): AsyncIterator<U> {
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
    [ASYNC_ITERATOR_SYMBOL]() {
      return this;
    },
  };
}
