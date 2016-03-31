'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.assertValidName = assertValidName;

var _invariant = require('../jsutils/invariant');

var _invariant2 = _interopRequireDefault(_invariant);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var NAME_RX = /^[_a-zA-Z][_a-zA-Z0-9]*$/;

// Helper to assert that provided names are valid.

/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

function assertValidName(name) {
  (0, _invariant2.default)(NAME_RX.test(name), 'Names must match /^[_a-zA-Z][_a-zA-Z0-9]*$/ but "' + name + '" does not.');
}