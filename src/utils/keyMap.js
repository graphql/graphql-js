/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

export default function keyMap<T>(
  list: Array<T>,
  keyFn: (item: T) => string
): {[key: string]: T} {
  return list.reduce((map, item) => ((map[keyFn(item)] = item), map), {});
}
