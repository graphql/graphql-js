'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

exports.valueFromAST = valueFromAST;

var _keyMap = require('../jsutils/keyMap');

var _keyMap2 = _interopRequireDefault(_keyMap);

var _invariant = require('../jsutils/invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _isNullish = require('../jsutils/isNullish');

var _isNullish2 = _interopRequireDefault(_isNullish);

var _kinds = require('../language/kinds');

var Kind = _interopRequireWildcard(_kinds);

var _definition = require('../type/definition');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Produces a JavaScript value given a GraphQL Value AST.
 *
 * A GraphQL type must be provided, which will be used to interpret different
 * GraphQL Value literals.
 *
 * | GraphQL Value        | JSON Value    |
 * | -------------------- | ------------- |
 * | Input Object         | Object        |
 * | List                 | Array         |
 * | Boolean              | Boolean       |
 * | String / Enum Value  | String        |
 * | Int / Float          | Number        |
 *
 */
function valueFromAST(valueAST, type, variables) {
  if (type instanceof _definition.GraphQLNonNull) {
    // Note: we're not checking that the result of valueFromAST is non-null.
    // We're assuming that this query has been validated and the value used
    // here is of the correct type.
    return valueFromAST(valueAST, type.ofType, variables);
  }

  if (!valueAST) {
    return null;
  }

  if (valueAST.kind === Kind.VARIABLE) {
    var variableName = valueAST.name.value;
    if (!variables || !variables.hasOwnProperty(variableName)) {
      return null;
    }
    // Note: we're not doing any checking that this variable is correct. We're
    // assuming that this query has been validated and the variable usage here
    // is of the correct type.
    return variables[variableName];
  }

  if (type instanceof _definition.GraphQLList) {
    var _ret = function () {
      var itemType = type.ofType;
      if (valueAST.kind === Kind.LIST) {
        return {
          v: valueAST.values.map(function (itemAST) {
            return valueFromAST(itemAST, itemType, variables);
          })
        };
      }
      return {
        v: [valueFromAST(valueAST, itemType, variables)]
      };
    }();

    if ((typeof _ret === 'undefined' ? 'undefined' : (0, _typeof3.default)(_ret)) === "object") return _ret.v;
  }

  if (type instanceof _definition.GraphQLInputObjectType) {
    var _ret2 = function () {
      var fields = type.getFields();
      if (valueAST.kind !== Kind.OBJECT) {
        return {
          v: null
        };
      }
      var fieldASTs = (0, _keyMap2.default)(valueAST.fields, function (field) {
        return field.name.value;
      });
      return {
        v: (0, _keys2.default)(fields).reduce(function (obj, fieldName) {
          var field = fields[fieldName];
          var fieldAST = fieldASTs[fieldName];
          var fieldValue = valueFromAST(fieldAST && fieldAST.value, field.type, variables);
          if ((0, _isNullish2.default)(fieldValue)) {
            fieldValue = field.defaultValue;
          }
          if (!(0, _isNullish2.default)(fieldValue)) {
            obj[fieldName] = fieldValue;
          }
          return obj;
        }, {})
      };
    }();

    if ((typeof _ret2 === 'undefined' ? 'undefined' : (0, _typeof3.default)(_ret2)) === "object") return _ret2.v;
  }

  (0, _invariant2.default)(type instanceof _definition.GraphQLScalarType || type instanceof _definition.GraphQLEnumType, 'Must be input type');

  var parsed = type.parseLiteral(valueAST);
  if (!(0, _isNullish2.default)(parsed)) {
    return parsed;
  }
}
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */