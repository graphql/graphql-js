/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

declare function find<T>(
  list: $ReadOnlyArray<T>,
  predicate: (item: T) => boolean,
): T | void;

/* eslint-disable no-redeclare */
// $FlowFixMe
const find = Array.prototype.find
  ? function(list, predicate) {
      return Array.prototype.find.call(list, predicate);
    }
  : function(list, predicate) {
      for (let i = 0; i < list.length; i++) {
        const value = list[i];
        if (predicate(value)) {
          return value;
        }
      }
    };
export default find;
