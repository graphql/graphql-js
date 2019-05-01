/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

declare function flatMap<T, U>(
  list: $ReadOnlyArray<T>,
  fn: (item: T, index: number) => $ReadOnlyArray<U> | U,
): Array<U>;

/* eslint-disable no-redeclare */
// $FlowFixMe
const flatMap = Array.prototype.flatMap
  ? function(list, fn) {
      // $FlowFixMe
      return Array.prototype.flatMap.call(list, fn);
    }
  : function(list, fn) {
      let result = [];
      for (let i = 0; i < list.length; i++) {
        const value = fn(list[i]);
        if (Array.isArray(value)) {
          result = result.concat(value);
        } else {
          result.push(value);
        }
      }
      return result;
    };
export default flatMap;
