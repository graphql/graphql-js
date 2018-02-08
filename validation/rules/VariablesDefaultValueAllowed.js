'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.defaultForRequiredVarMessage = defaultForRequiredVarMessage;
exports.VariablesDefaultValueAllowed = VariablesDefaultValueAllowed;

var _error = require('../../error');

var _definition = require('../../type/definition');

function defaultForRequiredVarMessage(varName, type, guessType) {
  return 'Variable "$' + varName + '" of type "' + String(type) + '" is required and ' + 'will not use the default value. ' + ('Perhaps you meant to use type "' + String(guessType) + '".');
}

/**
 * Variable's default value is allowed
 *
 * A GraphQL document is only valid if all variable default values are allowed
 * due to a variable not being required.
 */
/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */

function VariablesDefaultValueAllowed(context) {
  return {
    VariableDefinition: function VariableDefinition(node) {
      var name = node.variable.name.value;
      var defaultValue = node.defaultValue;
      var type = context.getInputType();
      if ((0, _definition.isNonNullType)(type) && defaultValue) {
        context.reportError(new _error.GraphQLError(defaultForRequiredVarMessage(name, type, type.ofType), [defaultValue]));
      }
      return false; // Do not traverse further.
    },

    SelectionSet: function SelectionSet() {
      return false;
    },
    FragmentDefinition: function FragmentDefinition() {
      return false;
    }
  };
}