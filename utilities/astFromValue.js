'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; /**
                                                                                                                                                                                                                                                                               * Copyright (c) 2015-present, Facebook, Inc.
                                                                                                                                                                                                                                                                               *
                                                                                                                                                                                                                                                                               * This source code is licensed under the MIT license found in the
                                                                                                                                                                                                                                                                               * LICENSE file in the root directory of this source tree.
                                                                                                                                                                                                                                                                               *
                                                                                                                                                                                                                                                                               * 
                                                                                                                                                                                                                                                                               */

exports.astFromValue = astFromValue;

var _iterall = require('iterall');

var _isNullish = require('../jsutils/isNullish');

var _isNullish2 = _interopRequireDefault(_isNullish);

var _isInvalid = require('../jsutils/isInvalid');

var _isInvalid2 = _interopRequireDefault(_isInvalid);

var _kinds = require('../language/kinds');

var Kind = _interopRequireWildcard(_kinds);

var _definition = require('../type/definition');

var _scalars = require('../type/scalars');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

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

  if ((0, _definition.isNonNullType)(type)) {
    var astValue = astFromValue(_value, type.ofType);
    if (astValue && astValue.kind === Kind.NULL) {
      return null;
    }
    return astValue;
  }

  // only explicit null, not undefined, NaN
  if (_value === null) {
    return { kind: Kind.NULL };
  }

  // undefined, NaN
  if ((0, _isInvalid2.default)(_value)) {
    return null;
  }

  // Convert JavaScript array to GraphQL list. If the GraphQLType is a list, but
  // the value is not an array, convert the value using the list's item type.
  if ((0, _definition.isListType)(type)) {
    var itemType = type.ofType;
    if ((0, _iterall.isCollection)(_value)) {
      var valuesNodes = [];
      (0, _iterall.forEach)(_value, function (item) {
        var itemNode = astFromValue(item, itemType);
        if (itemNode) {
          valuesNodes.push(itemNode);
        }
      });
      return { kind: Kind.LIST, values: valuesNodes };
    }
    return astFromValue(_value, itemType);
  }

  // Populate the fields of the input object by creating ASTs from each value
  // in the JavaScript object according to the fields in the input type.
  if ((0, _definition.isInputObjectType)(type)) {
    if (_value === null || (typeof _value === 'undefined' ? 'undefined' : _typeof(_value)) !== 'object') {
      return null;
    }
    var fields = type.getFields();
    var fieldNodes = [];
    Object.keys(fields).forEach(function (fieldName) {
      var fieldType = fields[fieldName].type;
      var fieldValue = astFromValue(_value[fieldName], fieldType);
      if (fieldValue) {
        fieldNodes.push({
          kind: Kind.OBJECT_FIELD,
          name: { kind: Kind.NAME, value: fieldName },
          value: fieldValue
        });
      }
    });
    return { kind: Kind.OBJECT, fields: fieldNodes };
  }

  if ((0, _definition.isScalarType)(type) || (0, _definition.isEnumType)(type)) {
    // Since value is an internally represented value, it must be serialized
    // to an externally represented value before converting into an AST.
    var serialized = type.serialize(_value);
    if ((0, _isNullish2.default)(serialized)) {
      return null;
    }

    // Others serialize based on their corresponding JavaScript scalar types.
    if (typeof serialized === 'boolean') {
      return { kind: Kind.BOOLEAN, value: serialized };
    }

    // JavaScript numbers can be Int or Float values.
    if (typeof serialized === 'number') {
      var stringNum = String(serialized);
      return (/^[0-9]+$/.test(stringNum) ? { kind: Kind.INT, value: stringNum } : { kind: Kind.FLOAT, value: stringNum }
      );
    }

    if (typeof serialized === 'string') {
      // Enum types use Enum literals.
      if ((0, _definition.isEnumType)(type)) {
        return { kind: Kind.ENUM, value: serialized };
      }

      // ID types can use Int literals.
      if (type === _scalars.GraphQLID && /^[0-9]+$/.test(serialized)) {
        return { kind: Kind.INT, value: serialized };
      }

      // Use JSON stringify, which uses the same string encoding as GraphQL,
      // then remove the quotes.
      return {
        kind: Kind.STRING,
        value: JSON.stringify(serialized).slice(1, -1)
      };
    }

    throw new TypeError('Cannot convert value to AST: ' + String(serialized));
  }

  /* istanbul ignore next */
  throw new Error('Unknown type: ' + type + '.');
}