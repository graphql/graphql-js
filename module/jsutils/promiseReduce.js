/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

import getPromise from './getPromise';


/**
 * Similar to Array.prototype.reduce(), however the reducing callback may return
 * a Promise, in which case reduction will continue after each promise resolves.
 *
 * If the callback does not return a Promise, then this function will also not
 * return a Promise.
 */
export default function promiseReduce(values, callback, initialValue) {
  return values.reduce(function (previous, value) {
    var promise = getPromise(previous);
    if (promise) {
      return promise.then(function (resolved) {
        return callback(resolved, value);
      });
    }
    // Previous is not Promise<U>, so it is U.
    return callback(previous, value);
  }, initialValue);
}