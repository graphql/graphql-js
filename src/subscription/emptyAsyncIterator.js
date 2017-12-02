/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import { $$asyncIterator } from 'iterall';

/**
 * Returns an AsyncIterable which yields no values.
 */
export default function emptyAsyncIterator(): AsyncIterator<void> {
  // TODO: Flow doesn't support symbols as keys:
  // https://github.com/facebook/flow/issues/3258
  return ({
    next() {
      return Promise.resolve({ value: undefined, done: true });
    },
    return() {
      return Promise.resolve({ value: undefined, done: true });
    },
    throw(error) {
      return Promise.reject(error);
    },
    [$$asyncIterator]() {
      return this;
    },
  }: any);
}
