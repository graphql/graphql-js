'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.noSubselectionAllowedMessage = noSubselectionAllowedMessage;
exports.requiredSubselectionMessage = requiredSubselectionMessage;
exports.ScalarLeafs = ScalarLeafs;

var _inspect = require('../../jsutils/inspect');

var _inspect2 = _interopRequireDefault(_inspect);

var _error = require('../../error');

var _definition = require('../../type/definition');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function noSubselectionAllowedMessage(fieldName, type) {
  return 'Field "' + fieldName + '" must not have a selection since ' + ('type "' + (0, _inspect2.default)(type) + '" has no subfields.');
} /**
   * Copyright (c) 2015-present, Facebook, Inc.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   *  strict
   */

function requiredSubselectionMessage(fieldName, type) {
  return 'Field "' + fieldName + '" of type "' + (0, _inspect2.default)(type) + '" must have a ' + ('selection of subfields. Did you mean "' + fieldName + ' { ... }"?');
}

/**
 * Scalar leafs
 *
 * A GraphQL document is valid only if all leaf fields (fields without
 * sub selections) are of scalar or enum types.
 */
function ScalarLeafs(context) {
  return {
    Field: function Field(node) {
      var type = context.getType();
      var selectionSet = node.selectionSet;
      if (type) {
        if ((0, _definition.isLeafType)((0, _definition.getNamedType)(type))) {
          if (selectionSet) {
            context.reportError(new _error.GraphQLError(noSubselectionAllowedMessage(node.name.value, type), [selectionSet]));
          }
        } else if (!selectionSet) {
          context.reportError(new _error.GraphQLError(requiredSubselectionMessage(node.name.value, type), [node]));
        }
      }
    }
  };
}