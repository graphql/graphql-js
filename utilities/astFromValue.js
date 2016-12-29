'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.astFromValue = astFromValue;

var _iterall = require('iterall');

var _invariant = require('../jsutils/invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _isNullish = require('../jsutils/isNullish');

var _isNullish2 = _interopRequireDefault(_isNullish);

var _isInvalid = require('../jsutils/isInvalid');

var _isInvalid2 = _interopRequireDefault(_isInvalid);

var _kinds = require('../language/kinds');

var _definition = require('../type/definition');

var _scalars = require('../type/scalars');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Produces a GraphQL Value AST given a JavaScript value.
 *
 * A GraphQL type must be provided, which will be used to interpret different
 * JavaScript values.
 *
 * | JSON Value    | GraphQL Value        |
 * | ------------- | -------------------- |
 * | Object        | Input Object         |
 * | Array         | List                 |
 * | Boolean       | Boolean              |
 * | String        | String / Enum Value  |
 * | Number        | Int / Float          |
 * | Mixed         | Enum Value           |
 * | null          | NullValue            |
 *
 */
function astFromValue(value, type) {
  // Ensure flow knows that we treat function params as const.
  var _value = value;

  if (type instanceof _definition.GraphQLNonNull) {
    var astValue = astFromValue(_value, type.ofType);
    if (astValue && astValue.kind === _kinds.NULL) {
      return null;
    }
    return astValue;
  }

  // only explicit null, not undefined, NaN
  if (_value === null) {
    return { kind: _kinds.NULL };
  }

  // undefined, NaN
  if ((0, _isInvalid2.default)(_value)) {
    return null;
  }

  // Convert JavaScript array to GraphQL list. If the GraphQLType is a list, but
  // the value is not an array, convert the value using the list's item type.
  if (type instanceof _definition.GraphQLList) {
    var _ret = function () {
      var itemType = type.ofType;
      if ((0, _iterall.isCollection)(_value)) {
        var _ret2 = function () {
          var valuesNodes = [];
          (0, _iterall.forEach)(_value, function (item) {
            var itemNode = astFromValue(item, itemType);
            if (itemNode) {
              valuesNodes.push(itemNode);
            }
          });
          return {
            v: {
              v: { kind: _kinds.LIST, values: valuesNodes }
            }
          };
        }();

        if (typeof _ret2 === "object") return _ret2.v;
      }
      return {
        v: astFromValue(_value, itemType)
      };
    }();

    if (typeof _ret === "object") return _ret.v;
  }

  // Populate the fields of the input object by creating ASTs from each value
  // in the JavaScript object according to the fields in the input type.
  if (type instanceof _definition.GraphQLInputObjectType) {
    var _ret3 = function () {
      if (_value === null || typeof _value !== 'object') {
        return {
          v: null
        };
      }
      var fields = type.getFields();
      var fieldNodes = [];
      Object.keys(fields).forEach(function (fieldName) {
        var fieldType = fields[fieldName].type;
        var fieldValue = astFromValue(_value[fieldName], fieldType);
        if (fieldValue) {
          fieldNodes.push({
            kind: _kinds.OBJECT_FIELD,
            name: { kind: _kinds.NAME, value: fieldName },
            value: fieldValue
          });
        }
      });
      return {
        v: { kind: _kinds.OBJECT, fields: fieldNodes }
      };
    }();

    if (typeof _ret3 === "object") return _ret3.v;
  }

  (0, _invariant2.default)(type instanceof _definition.GraphQLScalarType || type instanceof _definition.GraphQLEnumType, 'Must provide Input Type, cannot use: ' + String(type));

  // Since value is an internally represented value, it must be serialized
  // to an externally represented value before converting into an AST.
  var serialized = type.serialize(_value);
  if ((0, _isNullish2.default)(serialized)) {
    return null;
  }

  // Others serialize based on their corresponding JavaScript scalar types.
  if (typeof serialized === 'boolean') {
    return { kind: _kinds.BOOLEAN, value: serialized };
  }

  // JavaScript numbers can be Int or Float values.
  if (typeof serialized === 'number') {
    var stringNum = String(serialized);
    return (/^[0-9]+$/.test(stringNum) ? { kind: _kinds.INT, value: stringNum } : { kind: _kinds.FLOAT, value: stringNum }
    );
  }

  if (typeof serialized === 'string') {
    // Enum types use Enum literals.
    if (type instanceof _definition.GraphQLEnumType) {
      return { kind: _kinds.ENUM, value: serialized };
    }

    // ID types can use Int literals.
    if (type === _scalars.GraphQLID && /^[0-9]+$/.test(serialized)) {
      return { kind: _kinds.INT, value: serialized };
    }

    // Use JSON stringify, which uses the same string encoding as GraphQL,
    // then remove the quotes.
    return {
      kind: _kinds.STRING,
      value: JSON.stringify(serialized).slice(1, -1)
    };
  }

  throw new TypeError('Cannot convert value to AST: ' + String(serialized));
}
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */