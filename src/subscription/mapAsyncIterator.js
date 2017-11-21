/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
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
  callback: T => Promise<U> | U,
  rejectCallback?: any => Promise<U> | U
): AsyncGenerator<U, void, void> {
  const iterator = getAsyncIterator(iterable);
  let $return;
  let abruptClose;
  if (typeof iterator.return === 'function') {
    $return = iterator.return;
    abruptClose = error => {
      const rethrow = () => Promise.reject(error);
      return $return.call(iterator).then(rethrow, rethrow);
    };
  }

  function mapResult(result) {
    return result.done ?
      result :
      asyncMapValue(result.value, callback).then(iteratorResult, abruptClose);
  }

  let mapReject;
  if (rejectCallback) {
    // Capture rejectCallback to ensure it cannot be null.
    const reject = rejectCallback;
    mapReject = error =>
      asyncMapValue(error, reject).then(iteratorResult, abruptClose);
  }

  /* TODO: Flow doesn't support symbols as keys:
     https://github.com/facebook/flow/issues/3258 */
  return ({
    next() {
      return iterator.next().then(mapResult, mapReject);
    },
    return() {
      return $return ?
        $return.call(iterator).then(mapResult, mapReject) :
        Promise.resolve({ value: undefined, done: true });
    },
    throw(error) {
      if (typeof iterator.throw === 'function') {
        return iterator.throw(error).then(mapResult, mapReject);
      }
      return Promise.reject(error).catch(abruptClose);
    },
    [$$asyncIterator]() {
      return this;
    },
  }: any);
}

function asyncMapValue<T, U>(
  value: T,
  callback: T => Promise<U> | U
): Promise<U> {
  return new Promise(resolve => resolve(callback(value)));
}

function iteratorResult<T>(value: T): IteratorResult<T, void> {
  return { value, done: false };
}
