'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.defaultForNonNullArgMessage = defaultForNonNullArgMessage;
exports.badValueForDefaultArgMessage = badValueForDefaultArgMessage;
exports.DefaultValuesOfCorrectType = DefaultValuesOfCorrectType;

var _error = require('../../error');

var _printer = require('../../language/printer');

var _definition = require('../../type/definition');

var _isValidLiteralValue = require('../../utilities/isValidLiteralValue');

function defaultForNonNullArgMessage(varName, type, guessType) {
  return 'Variable "$' + varName + '" of type "' + type + '" is required and will not ' + ('use the default value. Perhaps you meant to use type "' + guessType + '".');
}
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

function badValueForDefaultArgMessage(varName, type, value, verboseErrors) {
  var message = verboseErrors ? '\n' + verboseErrors.join('\n') : '';
  return 'Variable "$' + varName + '" has invalid default value ' + value + '.' + message;
}

/**
 * Variable default values of correct type
 *
 * A GraphQL document is only valid if all variable default values are of the
 * type expected by their definition.
 */
function DefaultValuesOfCorrectType(context) {
  return {
    VariableDefinition: function VariableDefinition(varDefAST) {
      var name = varDefAST.variable.name.value;
      var defaultValue = varDefAST.defaultValue;
      var type = context.getInputType();
      if (type instanceof _definition.GraphQLNonNull && defaultValue) {
        context.reportError(new _error.GraphQLError(defaultForNonNullArgMessage(name, type, type.ofType), [defaultValue]));
      }
      if (type && defaultValue) {
        var errors = (0, _isValidLiteralValue.isValidLiteralValue)(type, defaultValue);
        if (errors && errors.length > 0) {
          context.reportError(new _error.GraphQLError(badValueForDefaultArgMessage(name, type, (0, _printer.print)(defaultValue), errors), [defaultValue]));
        }
      }
      return false;
    },

    SelectionSet: function SelectionSet() {
      return false;
    },
    FragmentDefinition: function FragmentDefinition() {
      return false;
    }
  };
}