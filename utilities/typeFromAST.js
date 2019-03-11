"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.typeFromAST = typeFromAST;

var _inspect = _interopRequireDefault(require("../jsutils/inspect"));

var _kinds = require("../language/kinds");

var _definition = require("../type/definition");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
function typeFromAST(schema, typeNode) {
  /* eslint-enable no-redeclare */
  var innerType;

  if (typeNode.kind === _kinds.Kind.LIST_TYPE) {
    innerType = typeFromAST(schema, typeNode.type);
    return innerType && (0, _definition.GraphQLList)(innerType);
  }

  if (typeNode.kind === _kinds.Kind.NON_NULL_TYPE) {
    innerType = typeFromAST(schema, typeNode.type);
    return innerType && (0, _definition.GraphQLNonNull)(innerType);
  }

  if (typeNode.kind === _kinds.Kind.NAMED_TYPE) {
    return schema.getType(typeNode.name.value);
  } // Not reachable. All possible type nodes have been considered.

  /* istanbul ignore next */


  throw new Error("Unexpected type node: \"".concat((0, _inspect.default)(typeNode), "\"."));
}