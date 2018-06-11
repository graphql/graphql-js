"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = inspect;

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */

/**
 * Used to print values in error messages.
 */
function inspect(value) {
  return value && _typeof(value) === 'object' ? typeof value.inspect === 'function' ? value.inspect() : Array.isArray(value) ? '[' + value.map(inspect).join(', ') + ']' : '{' + Object.keys(value).map(function (k) {
    return "".concat(k, ": ").concat(inspect(value[k]));
  }).join(', ') + '}' : typeof value === 'string' ? '"' + value + '"' : typeof value === 'function' ? "[function ".concat(value.name, "]") : String(value);
}