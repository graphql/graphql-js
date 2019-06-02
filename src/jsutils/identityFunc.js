/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

/**
 * Returns the first argument it receives.
 */
export default function identityFunc<T>(x: T): T {
  return x;
}
