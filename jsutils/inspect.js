"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = inspect;

/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */
function inspect(value) {
  if (Array.isArray(value)) {
    return '[' + String(value) + ']';
  }

  return String(value);
}