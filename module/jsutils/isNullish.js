/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

/**
 * Returns true if a value is null, undefined, or NaN.
 */
export default function isNullish(value) {
  return value === null || value === undefined || value !== value;
}