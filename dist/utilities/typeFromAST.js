'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.typeFromAST = typeFromAST;

var _invariant = require('../jsutils/invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _kinds = require('../language/kinds');

var _definition = require('../type/definition');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function typeFromAST(schema, inputTypeAST) {
  var innerType = void 0;
  if (inputTypeAST.kind === _kinds.LIST_TYPE) {
    innerType = typeFromAST(schema, inputTypeAST.type);
    return innerType && new _definition.GraphQLList(innerType);
  }
  if (inputTypeAST.kind === _kinds.NON_NULL_TYPE) {
    innerType = typeFromAST(schema, inputTypeAST.type);
    return innerType && new _definition.GraphQLNonNull(innerType);
  }
  (0, _invariant2.default)(inputTypeAST.kind === _kinds.NAMED_TYPE, 'Must be a named type.');
  return schema.getType(inputTypeAST.name.value);
}
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */