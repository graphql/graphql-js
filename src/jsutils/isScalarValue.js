/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

/**
 * Returns true if a value is a javascript scalar type: String, Number, Boolean
 */

const JS_SCALAR_RX = /\[object String|Number|Boolean\]/;
const toString = Object.prototype.toString;

export default function isScalarValue(value: mixed): boolean {
  return JS_SCALAR_RX.test(toString.call(value));
}
