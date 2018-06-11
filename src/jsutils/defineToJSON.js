/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

/**
 * The `applyToJSON()` function defines toJSON() and inspect() prototype
 * methods which are aliases for toString().
 */
export default function applyToJSON(classObject: Class<any>): void {
  classObject.prototype.toJSON = classObject.prototype.inspect =
    classObject.prototype.toString;
}
