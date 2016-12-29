'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.valueFromAST = valueFromAST;

var _keyMap = require('../jsutils/keyMap');

var _keyMap2 = _interopRequireDefault(_keyMap);

var _invariant = require('../jsutils/invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _isNullish = require('../jsutils/isNullish');

var _isNullish2 = _interopRequireDefault(_isNullish);

var _isInvalid = require('../jsutils/isInvalid');

var _isInvalid2 = _interopRequireDefault(_isInvalid);

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
 * Returns `undefined` when the value could not be validly coerced according to
 * the provided type.
 *
 * | GraphQL Value        | JSON Value    |
 * | -------------------- | ------------- |
 * | Input Object         | Object        |
 * | List                 | Array         |
 * | Boolean              | Boolean       |
 * | String               | String        |
 * | Int / Float          | Number        |
 * | Enum Value           | Mixed         |
 * | NullValue            | null          |
 *
 */

/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

function valueFromAST(valueNode, type, variables) {
  if (!valueNode) {
    // When there is no node, then there is also no value.
    // Importantly, this is different from returning the value null.
    return;
  }

  if (type instanceof _definition.GraphQLNonNull) {
    if (valueNode.kind === Kind.NULL) {
      return; // Invalid: intentionally return no value.
    }
    return valueFromAST(valueNode, type.ofType, variables);
  }

  if (valueNode.kind === Kind.NULL) {
    // This is explicitly returning the value null.
    return null;
  }

  if (valueNode.kind === Kind.VARIABLE) {
    var variableName = valueNode.name.value;
    if (!variables || (0, _isInvalid2.default)(variables[variableName])) {
      // No valid return value.
      return;
    }
    // Note: we're not doing any checking that this variable is correct. We're
    // assuming that this query has been validated and the variable usage here
    // is of the correct type.
    return variables[variableName];
  }

  if (type instanceof _definition.GraphQLList) {
    var itemType = type.ofType;
    if (valueNode.kind === Kind.LIST) {
      var coercedValues = [];
      var itemNodes = valueNode.values;
      for (var i = 0; i < itemNodes.length; i++) {
        if (isMissingVariable(itemNodes[i], variables)) {
          // If an array contains a missing variable, it is either coerced to
          // null or if the item type is non-null, it considered invalid.
          if (itemType instanceof _definition.GraphQLNonNull) {
            return; // Invalid: intentionally return no value.
          }
          coercedValues.push(null);
        } else {
          var itemValue = valueFromAST(itemNodes[i], itemType, variables);
          if ((0, _isInvalid2.default)(itemValue)) {
            return; // Invalid: intentionally return no value.
          }
          coercedValues.push(itemValue);
        }
      }
      return coercedValues;
    }
    var coercedValue = valueFromAST(valueNode, itemType, variables);
    if ((0, _isInvalid2.default)(coercedValue)) {
      return; // Invalid: intentionally return no value.
    }
    return [coercedValue];
  }

  if (type instanceof _definition.GraphQLInputObjectType) {
    if (valueNode.kind !== Kind.OBJECT) {
      return; // Invalid: intentionally return no value.
    }
    var coercedObj = Object.create(null);
    var fields = type.getFields();
    var fieldNodes = (0, _keyMap2.default)(valueNode.fields, function (field) {
      return field.name.value;
    });
    var fieldNames = Object.keys(fields);
    for (var _i = 0; _i < fieldNames.length; _i++) {
      var fieldName = fieldNames[_i];
      var field = fields[fieldName];
      var fieldNode = fieldNodes[fieldName];
      if (!fieldNode || isMissingVariable(fieldNode.value, variables)) {
        if (!(0, _isInvalid2.default)(field.defaultValue)) {
          coercedObj[fieldName] = field.defaultValue;
        } else if (field.type instanceof _definition.GraphQLNonNull) {
          return; // Invalid: intentionally return no value.
        }
        continue;
      }
      var fieldValue = valueFromAST(fieldNode.value, field.type, variables);
      if ((0, _isInvalid2.default)(fieldValue)) {
        return; // Invalid: intentionally return no value.
      }
      coercedObj[fieldName] = fieldValue;
    }
    return coercedObj;
  }

  (0, _invariant2.default)(type instanceof _definition.GraphQLScalarType || type instanceof _definition.GraphQLEnumType, 'Must be input type');

  var parsed = type.parseLiteral(valueNode);
  if ((0, _isNullish2.default)(parsed)) {
    // null or invalid values represent a failure to parse correctly,
    // in which case no value is returned.
    return;
  }

  return parsed;
}

// Returns true if the provided valueNode is a variable which is not defined
// in the set of variables.
function isMissingVariable(valueNode, variables) {
  return valueNode.kind === Kind.VARIABLE && (!variables || (0, _isInvalid2.default)(variables[valueNode.name.value]));
}