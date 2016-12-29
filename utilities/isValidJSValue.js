'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isValidJSValue = isValidJSValue;

var _iterall = require('iterall');

var _invariant = require('../jsutils/invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _isNullish = require('../jsutils/isNullish');

var _isNullish2 = _interopRequireDefault(_isNullish);

var _definition = require('../type/definition');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Given a JavaScript value and a GraphQL type, determine if the value will be
 * accepted for that type. This is primarily useful for validating the
 * runtime values of query variables.
 */

/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

function isValidJSValue(value, type) {
  // A value must be provided if the type is non-null.
  if (type instanceof _definition.GraphQLNonNull) {
    if ((0, _isNullish2.default)(value)) {
      return ['Expected "' + String(type) + '", found null.'];
    }
    return isValidJSValue(value, type.ofType);
  }

  if ((0, _isNullish2.default)(value)) {
    return [];
  }

  // Lists accept a non-list value as a list of one.
  if (type instanceof _definition.GraphQLList) {
    var _ret = function () {
      var itemType = type.ofType;
      if ((0, _iterall.isCollection)(value)) {
        var _ret2 = function () {
          var errors = [];
          (0, _iterall.forEach)(value, function (item, index) {
            errors.push.apply(errors, isValidJSValue(item, itemType).map(function (error) {
              return 'In element #' + index + ': ' + error;
            }));
          });
          return {
            v: {
              v: errors
            }
          };
        }();

        if (typeof _ret2 === "object") return _ret2.v;
      }
      return {
        v: isValidJSValue(value, itemType)
      };
    }();

    if (typeof _ret === "object") return _ret.v;
  }

  // Input objects check each defined field.
  if (type instanceof _definition.GraphQLInputObjectType) {
    var _ret3 = function () {
      if (typeof value !== 'object' || value === null) {
        return {
          v: ['Expected "' + type.name + '", found not an object.']
        };
      }
      var fields = type.getFields();

      var errors = [];

      // Ensure every provided field is defined.
      Object.keys(value).forEach(function (providedField) {
        if (!fields[providedField]) {
          errors.push('In field "' + providedField + '": Unknown field.');
        }
      });

      // Ensure every defined field is valid.
      Object.keys(fields).forEach(function (fieldName) {
        var newErrors = isValidJSValue(value[fieldName], fields[fieldName].type);
        errors.push.apply(errors, newErrors.map(function (error) {
          return 'In field "' + fieldName + '": ' + error;
        }));
      });

      return {
        v: errors
      };
    }();

    if (typeof _ret3 === "object") return _ret3.v;
  }

  (0, _invariant2.default)(type instanceof _definition.GraphQLScalarType || type instanceof _definition.GraphQLEnumType, 'Must be input type');

  // Scalar/Enum input checks to ensure the type can parse the value to
  // a non-null value.
  try {
    var parseResult = type.parseValue(value);
    if ((0, _isNullish2.default)(parseResult)) {
      return ['Expected type "' + type.name + '", found ' + JSON.stringify(value) + '.'];
    }
  } catch (error) {
    return ['Expected type "' + type.name + '", found ' + JSON.stringify(value) + ': ' + error.message];
  }

  return [];
}