"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.applyToStringTag = applyToStringTag;
exports.default = void 0;

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
 * The `applyToStringTag()` function checks first to see if the runtime
 * supports the `Symbol` class and then if the `Symbol.toStringTag` constant
 * is defined as a `Symbol` instance. If both conditions are met, the
 * Symbol.toStringTag property is defined as a getter that returns the
 * supplied class constructor's name.
 *
 * @method applyToStringTag
 *
 * @param {Class<*>} classObject a class such as Object, String, Number but
 * typically one of your own creation through the class keyword; `class A {}`,
 * for example.
 */
function applyToStringTag(classObject) {
  var symbolType = typeof Symbol === "undefined" ? "undefined" : _typeof(Symbol);

  var toStringTagType = _typeof(Symbol.toStringTag);

  if (symbolType === 'function' && toStringTagType === 'symbol') {
    Object.defineProperty(classObject.prototype, Symbol.toStringTag, {
      get: function get() {
        return this.constructor.name;
      }
    });
  }
}
/** Support both default export and named `applyToStringTag` export */


var _default = applyToStringTag;
exports.default = _default;