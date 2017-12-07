/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import orList from './orList';

/**
 * Given [ A, B, C ] return '"A", "B", or "C"'.
 */
export default function quotedOrList(items: $ReadOnlyArray<string>): string {
  return orList(items.map(item => `"${item}"`));
}
