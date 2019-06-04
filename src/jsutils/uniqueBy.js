/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

/**
 * Returns an array of unique values based on iteratee
 * which is invoked for each element in array to generate
 * the criterion by which uniqueness is computed.
 *
 * Simiar to _.uniqBy from lodash.
 */
export function uniqueBy(
  array: $ReadOnlyArray<any>,
  iteratee: (item: any) => any,
) {
  const FilteredMap = new Map();
  const result = [];
  for (const item of array) {
    const uniqeValue = iteratee(item);
    if (!FilteredMap.has(uniqeValue)) {
      FilteredMap.set(uniqeValue, true);
      result.push(item);
    }
  }
  return result;
}
