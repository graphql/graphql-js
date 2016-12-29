'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isValidLiteralValue = isValidLiteralValue;

var _printer = require('../language/printer');

var _kinds = require('../language/kinds');

var _definition = require('../type/definition');

var _invariant = require('../jsutils/invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _keyMap = require('../jsutils/keyMap');

var _keyMap2 = _interopRequireDefault(_keyMap);

var _isNullish = require('../jsutils/isNullish');

var _isNullish2 = _interopRequireDefault(_isNullish);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Utility for validators which determines if a value literal node is valid
 * given an input type.
 *
 * Note that this only validates literal values, variables are assumed to
 * provide values of the correct type.
 */

/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

function isValidLiteralValue(type, valueNode) {
  // A value must be provided if the type is non-null.
  if (type instanceof _definition.GraphQLNonNull) {
    if (!valueNode || valueNode.kind === _kinds.NULL) {
      return ['Expected "' + String(type) + '", found null.'];
    }
    return isValidLiteralValue(type.ofType, valueNode);
  }

  if (!valueNode || valueNode.kind === _kinds.NULL) {
    return [];
  }

  // This function only tests literals, and assumes variables will provide
  // values of the correct type.
  if (valueNode.kind === _kinds.VARIABLE) {
    return [];
  }

  // Lists accept a non-list value as a list of one.
  if (type instanceof _definition.GraphQLList) {
    var _ret = function () {
      var itemType = type.ofType;
      if (valueNode.kind === _kinds.LIST) {
        return {
          v: valueNode.values.reduce(function (acc, item, index) {
            var errors = isValidLiteralValue(itemType, item);
            return acc.concat(errors.map(function (error) {
              return 'In element #' + index + ': ' + error;
            }));
          }, [])
        };
      }
      return {
        v: isValidLiteralValue(itemType, valueNode)
      };
    }();

    if (typeof _ret === "object") return _ret.v;
  }

  // Input objects check each defined field and look for undefined fields.
  if (type instanceof _definition.GraphQLInputObjectType) {
    var _ret2 = function () {
      if (valueNode.kind !== _kinds.OBJECT) {
        return {
          v: ['Expected "' + type.name + '", found not an object.']
        };
      }
      var fields = type.getFields();

      var errors = [];

      // Ensure every provided field is defined.
      var fieldNodes = valueNode.fields;
      fieldNodes.forEach(function (providedFieldNode) {
        if (!fields[providedFieldNode.name.value]) {
          errors.push('In field "' + providedFieldNode.name.value + '": Unknown field.');
        }
      });

      // Ensure every defined field is valid.
      var fieldNodeMap = (0, _keyMap2.default)(fieldNodes, function (fieldNode) {
        return fieldNode.name.value;
      });
      Object.keys(fields).forEach(function (fieldName) {
        var result = isValidLiteralValue(fields[fieldName].type, fieldNodeMap[fieldName] && fieldNodeMap[fieldName].value);
        errors.push.apply(errors, result.map(function (error) {
          return 'In field "' + fieldName + '": ' + error;
        }));
      });

      return {
        v: errors
      };
    }();

    if (typeof _ret2 === "object") return _ret2.v;
  }

  (0, _invariant2.default)(type instanceof _definition.GraphQLScalarType || type instanceof _definition.GraphQLEnumType, 'Must be input type');

  // Scalar/Enum input checks to ensure the type can parse the value to
  // a non-null value.
  var parseResult = type.parseLiteral(valueNode);
  if ((0, _isNullish2.default)(parseResult)) {
    return ['Expected type "' + type.name + '", found ' + (0, _printer.print)(valueNode) + '.'];
  }

  return [];
}