'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

exports.astFromValue = astFromValue;

var _invariant = require('../jsutils/invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _isNullish = require('../jsutils/isNullish');

var _isNullish2 = _interopRequireDefault(_isNullish);

var _kinds = require('../language/kinds');

var _definition = require('../type/definition');

var _scalars = require('../type/scalars');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Produces a GraphQL Value AST given a JavaScript value.
 *
 * Optionally, a GraphQL type may be provided, which will be used to
 * disambiguate between value primitives.
 *
 * | JSON Value    | GraphQL Value        |
 * | ------------- | -------------------- |
 * | Object        | Input Object         |
 * | Array         | List                 |
 * | Boolean       | Boolean              |
 * | String        | String / Enum Value  |
 * | Number        | Int / Float          |
 *
 */
function astFromValue(value, type) {
  // Ensure flow knows that we treat function params as const.
  var _value = value;

  if (type instanceof _definition.GraphQLNonNull) {
    // Note: we're not checking that the result is non-null.
    // This function is not responsible for validating the input value.
    return astFromValue(_value, type.ofType);
  }

  if ((0, _isNullish2.default)(_value)) {
    return null;
  }

  // Convert JavaScript array to GraphQL list. If the GraphQLType is a list, but
  // the value is not an array, convert the value using the list's item type.
  if (Array.isArray(_value)) {
    var _ret = function () {
      var itemType = type instanceof _definition.GraphQLList ? type.ofType : null;
      return {
        v: {
          kind: _kinds.LIST,
          values: _value.map(function (item) {
            var itemValue = astFromValue(item, itemType);
            (0, _invariant2.default)(itemValue, 'Could not create AST item.');
            return itemValue;
          })
        }
      };
    }();

    if ((typeof _ret === 'undefined' ? 'undefined' : (0, _typeof3.default)(_ret)) === "object") return _ret.v;
  } else if (type instanceof _definition.GraphQLList) {
    // Because GraphQL will accept single values as a "list of one" when
    // expecting a list, if there's a non-array value and an expected list type,
    // create an AST using the list's item type.
    return astFromValue(_value, type.ofType);
  }

  if (typeof _value === 'boolean') {
    return { kind: _kinds.BOOLEAN, value: _value };
  }

  // JavaScript numbers can be Float or Int values. Use the GraphQLType to
  // differentiate if available, otherwise prefer Int if the value is a
  // valid Int.
  if (typeof _value === 'number') {
    var stringNum = String(_value);
    var isIntValue = /^[0-9]+$/.test(stringNum);
    if (isIntValue) {
      if (type === _scalars.GraphQLFloat) {
        return { kind: _kinds.FLOAT, value: stringNum + '.0' };
      }
      return { kind: _kinds.INT, value: stringNum };
    }
    return { kind: _kinds.FLOAT, value: stringNum };
  }

  // JavaScript strings can be Enum values or String values. Use the
  // GraphQLType to differentiate if possible.
  if (typeof _value === 'string') {
    if (type instanceof _definition.GraphQLEnumType && /^[_a-zA-Z][_a-zA-Z0-9]*$/.test(_value)) {
      return { kind: _kinds.ENUM, value: _value };
    }
    // Use JSON stringify, which uses the same string encoding as GraphQL,
    // then remove the quotes.
    return { kind: _kinds.STRING, value: (0, _stringify2.default)(_value).slice(1, -1) };
  }

  // last remaining possible typeof
  (0, _invariant2.default)((typeof _value === 'undefined' ? 'undefined' : (0, _typeof3.default)(_value)) === 'object' && _value !== null);

  // Populate the fields of the input object by creating ASTs from each value
  // in the JavaScript object.
  var fields = [];
  (0, _keys2.default)(_value).forEach(function (fieldName) {
    var fieldType = void 0;
    if (type instanceof _definition.GraphQLInputObjectType) {
      var fieldDef = type.getFields()[fieldName];
      fieldType = fieldDef && fieldDef.type;
    }
    var fieldValue = astFromValue(_value[fieldName], fieldType);
    if (fieldValue) {
      fields.push({
        kind: _kinds.OBJECT_FIELD,
        name: { kind: _kinds.NAME, value: fieldName },
        value: fieldValue
      });
    }
  });
  return { kind: _kinds.OBJECT, fields: fields };
}
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */