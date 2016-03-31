'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

exports.badVarPosMessage = badVarPosMessage;
exports.VariablesInAllowedPosition = VariablesInAllowedPosition;

var _error = require('../../error');

var _definition = require('../../type/definition');

var _typeComparators = require('../../utilities/typeComparators');

var _typeFromAST = require('../../utilities/typeFromAST');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function badVarPosMessage(varName, varType, expectedType) {
  return 'Variable "$' + varName + '" of type "' + varType + '" used in position ' + ('expecting type "' + expectedType + '".');
}

/**
 * Variables passed to field arguments conform to type
 */

/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

function VariablesInAllowedPosition(context) {
  var varDefMap = (0, _create2.default)(null);

  return {
    OperationDefinition: {
      enter: function enter() {
        varDefMap = (0, _create2.default)(null);
      },
      leave: function leave(operation) {
        var usages = context.getRecursiveVariableUsages(operation);

        usages.forEach(function (_ref) {
          var node = _ref.node;
          var type = _ref.type;

          var varName = node.name.value;
          var varDef = varDefMap[varName];
          if (varDef && type) {
            // A var type is allowed if it is the same or more strict (e.g. is
            // a subtype of) than the expected type. It can be more strict if
            // the variable type is non-null when the expected type is nullable.
            // If both are list types, the variable item type can be more strict
            // than the expected item type (contravariant).
            var schema = context.getSchema();
            var varType = (0, _typeFromAST.typeFromAST)(schema, varDef.type);
            if (varType && !(0, _typeComparators.isTypeSubTypeOf)(schema, effectiveType(varType, varDef), type)) {
              context.reportError(new _error.GraphQLError(badVarPosMessage(varName, varType, type), [varDef, node]));
            }
          }
        });
      }
    },
    VariableDefinition: function VariableDefinition(varDefAST) {
      varDefMap[varDefAST.variable.name.value] = varDefAST;
    }
  };
}

// If a variable definition has a default value, it's effectively non-null.
function effectiveType(varType, varDef) {
  return !varDef.defaultValue || varType instanceof _definition.GraphQLNonNull ? varType : new _definition.GraphQLNonNull(varType);
}