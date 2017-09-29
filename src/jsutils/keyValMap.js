/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {ObjMap} from './ObjMap';

/**
 * Creates a keyed JS object from an array, given a function to produce the keys
 * and a function to produce the values from each item in the array.
 *
 *     const phoneBook = [
 *       { name: 'Jon', num: '555-1234' },
 *       { name: 'Jenny', num: '867-5309' }
 *     ]
 *
 *     // { Jon: '555-1234', Jenny: '867-5309' }
 *     const phonesByName = keyValMap(
 *       phoneBook,
 *       entry => entry.name,
 *       entry => entry.num
 *     )
 *
 */
export default function keyValMap<T, V>(
  list: Array<T>,
  keyFn: (item: T) => string,
  valFn: (item: T) => V
): ObjMap<V> {
  return list.reduce(
    (map, item) => ((map[keyFn(item)] = valFn(item)), map),
    Object.create(null)
  );
}
