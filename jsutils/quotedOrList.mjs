/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
import orList from './orList';
/**
 * Given [ A, B, C ] return '"A", "B", or "C"'.
 */

export default function quotedOrList(items) {
  return orList(items.map(function (item) {
    return "\"".concat(item, "\"");
  }));
}