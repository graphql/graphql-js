/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
import invariant from './invariant';
var MAX_LENGTH = 5;
/**
 * Given [ A, B, C ] return 'A, B, or C'.
 */

export default function orList(items) {
  !(items.length !== 0) ? invariant(0) : void 0;

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return items[0] + ' or ' + items[1];
  }

  var selected = items.slice(0, MAX_LENGTH);
  var lastItem = selected.pop();
  return selected.join(', ') + ', or ' + lastItem;
}