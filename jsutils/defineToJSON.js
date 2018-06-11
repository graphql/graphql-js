"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = applyToJSON;

/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */

/**
 * The `applyToJSON()` function defines toJSON() and inspect() prototype
 * methods which are aliases for toString().
 */
function applyToJSON(classObject) {
  classObject.prototype.toJSON = classObject.prototype.inspect = classObject.prototype.toString;
}