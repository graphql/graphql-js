'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.badValueMessage = badValueMessage;
exports.requiredFieldMessage = requiredFieldMessage;
exports.unknownFieldMessage = unknownFieldMessage;
exports.ValuesOfCorrectType = ValuesOfCorrectType;

var _error = require('../../error');

var _printer = require('../../language/printer');

var _definition = require('../../type/definition');

var _isInvalid = require('../../jsutils/isInvalid');

var _isInvalid2 = _interopRequireDefault(_isInvalid);

var _keyMap = require('../../jsutils/keyMap');

var _keyMap2 = _interopRequireDefault(_keyMap);

var _orList = require('../../jsutils/orList');

var _orList2 = _interopRequireDefault(_orList);

var _suggestionList = require('../../jsutils/suggestionList');

var _suggestionList2 = _interopRequireDefault(_suggestionList);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */

function badValueMessage(typeName, valueName, message) {
  return 'Expected type ' + typeName + ', found ' + valueName + (message ? '; ' + message : '.');
}

function requiredFieldMessage(typeName, fieldName, fieldTypeName) {
  return 'Field ' + typeName + '.' + fieldName + ' of required type ' + (fieldTypeName + ' was not provided.');
}

function unknownFieldMessage(typeName, fieldName, message) {
  return 'Field "' + fieldName + '" is not defined by type ' + typeName + (message ? '; ' + message : '.');
}

/**
 * Value literals of correct type
 *
 * A GraphQL document is only valid if all value literals are of the type
 * expected at their position.
 */
function ValuesOfCorrectType(context) {
  return {
    NullValue: function NullValue(node) {
      var type = context.getInputType();
      if ((0, _definition.isNonNullType)(type)) {
        context.reportError(new _error.GraphQLError(badValueMessage(String(type), (0, _printer.print)(node)), node));
      }
    },
    ListValue: function ListValue(node) {
      // Note: TypeInfo will traverse into a list's item type, so look to the
      // parent input type to check if it is a list.
      var type = (0, _definition.getNullableType)(context.getParentInputType());
      if (!(0, _definition.isListType)(type)) {
        isValidScalar(context, node);
        return false; // Don't traverse further.
      }
    },
    ObjectValue: function ObjectValue(node) {
      var type = (0, _definition.getNamedType)(context.getInputType());
      if (!(0, _definition.isInputObjectType)(type)) {
        isValidScalar(context, node);
        return false; // Don't traverse further.
      }
      // Ensure every required field exists.
      var inputFields = type.getFields();
      var fieldNodeMap = (0, _keyMap2.default)(node.fields, function (field) {
        return field.name.value;
      });
      Object.keys(inputFields).forEach(function (fieldName) {
        var fieldType = inputFields[fieldName].type;
        var fieldNode = fieldNodeMap[fieldName];
        if (!fieldNode && (0, _definition.isNonNullType)(fieldType)) {
          context.reportError(new _error.GraphQLError(requiredFieldMessage(type.name, fieldName, String(fieldType)), node));
        }
      });
    },
    ObjectField: function ObjectField(node) {
      var parentType = (0, _definition.getNamedType)(context.getParentInputType());
      var fieldType = context.getInputType();
      if (!fieldType && (0, _definition.isInputObjectType)(parentType)) {
        var suggestions = (0, _suggestionList2.default)(node.name.value, Object.keys(parentType.getFields()));
        var didYouMean = suggestions.length !== 0 ? 'Did you mean ' + (0, _orList2.default)(suggestions) + '?' : undefined;
        context.reportError(new _error.GraphQLError(unknownFieldMessage(parentType.name, node.name.value, didYouMean), node));
      }
    },
    EnumValue: function EnumValue(node) {
      var type = (0, _definition.getNamedType)(context.getInputType());
      if (!(0, _definition.isEnumType)(type)) {
        isValidScalar(context, node);
      } else if (!type.getValue(node.value)) {
        context.reportError(new _error.GraphQLError(badValueMessage(type.name, (0, _printer.print)(node), enumTypeSuggestion(type, node)), node));
      }
    },

    IntValue: function IntValue(node) {
      return isValidScalar(context, node);
    },
    FloatValue: function FloatValue(node) {
      return isValidScalar(context, node);
    },
    StringValue: function StringValue(node) {
      return isValidScalar(context, node);
    },
    BooleanValue: function BooleanValue(node) {
      return isValidScalar(context, node);
    }
  };
}

/**
 * Any value literal may be a valid representation of a Scalar, depending on
 * that scalar type.
 */
function isValidScalar(context, node) {
  // Report any error at the full type expected by the location.
  var locationType = context.getInputType();
  if (!locationType) {
    return;
  }

  var type = (0, _definition.getNamedType)(locationType);

  if (!(0, _definition.isScalarType)(type)) {
    context.reportError(new _error.GraphQLError(badValueMessage(String(locationType), (0, _printer.print)(node), enumTypeSuggestion(type, node)), node));
    return;
  }

  // Scalars determine if a literal value is valid via parseLiteral() which
  // may throw or return an invalid value to indicate failure.
  try {
    var parseResult = type.parseLiteral(node, undefined /* variables */);
    if ((0, _isInvalid2.default)(parseResult)) {
      context.reportError(new _error.GraphQLError(badValueMessage(String(locationType), (0, _printer.print)(node)), node));
    }
  } catch (error) {
    // Ensure a reference to the original error is maintained.
    context.reportError(new _error.GraphQLError(badValueMessage(String(locationType), (0, _printer.print)(node), error.message), node, undefined, undefined, undefined, error));
  }
}

function enumTypeSuggestion(type, node) {
  if ((0, _definition.isEnumType)(type)) {
    var suggestions = (0, _suggestionList2.default)((0, _printer.print)(node), type.getValues().map(function (value) {
      return value.name;
    }));
    if (suggestions.length !== 0) {
      return 'Did you mean the enum value ' + (0, _orList2.default)(suggestions) + '?';
    }
  }
}