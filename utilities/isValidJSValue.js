"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isValidJSValue = isValidJSValue;

var _coerceValue = require("./coerceValue");

/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

/**
 * Deprecated. Use coerceValue() directly for richer information.
 *
 * This function will be removed in v15
 */
function isValidJSValue(value, type) {
  var errors = (0, _coerceValue.coerceValue)(value, type).errors;
  return errors ? errors.map(function (error) {
    return error.message;
  }) : [];
}