'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = quotedOrList;

var _orList = require('./orList');

var _orList2 = _interopRequireDefault(_orList);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Given [ A, B, C ] return '"A", "B", or "C"'.
 */
function quotedOrList(items) {
  return (0, _orList2.default)(items.map(function (item) {
    return '"' + item + '"';
  }));
} /**
   * Copyright (c) 2015-present, Facebook, Inc.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   * 
   */