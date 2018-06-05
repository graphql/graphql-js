"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isSpecifiedScalarType = isSpecifiedScalarType;
exports.specifiedScalarTypes = exports.GraphQLID = exports.GraphQLBoolean = exports.GraphQLString = exports.GraphQLFloat = exports.GraphQLInt = void 0;

var _inspect = _interopRequireDefault(require("../jsutils/inspect"));

var _isInteger = _interopRequireDefault(require("../jsutils/isInteger"));

var _definition = require("./definition");

var _kinds = require("../language/kinds");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */
// As per the GraphQL Spec, Integers are only treated as valid when a valid
// 32-bit signed integer, providing the broadest support across platforms.
//
// n.b. JavaScript's integers are safe between -(2^53 - 1) and 2^53 - 1 because
// they are internally represented as IEEE 754 doubles.
var MAX_INT = 2147483647;
var MIN_INT = -2147483648;

function coerceInt(value) {
  if (Array.isArray(value)) {
    throw new TypeError("Int cannot represent an array value: [".concat(String(value), "]"));
  }

  if (value === '') {
    throw new TypeError('Int cannot represent non-integer value: (empty string)');
  }

  var num = Number(value);

  if (!(0, _isInteger.default)(num)) {
    throw new TypeError('Int cannot represent non-integer value: ' + (0, _inspect.default)(value));
  }

  if (num > MAX_INT || num < MIN_INT) {
    throw new TypeError('Int cannot represent non 32-bit signed integer value: ' + (0, _inspect.default)(value));
  }

  return num;
}

var GraphQLInt = new _definition.GraphQLScalarType({
  name: 'Int',
  description: 'The `Int` scalar type represents non-fractional signed whole numeric ' + 'values. Int can represent values between -(2^31) and 2^31 - 1. ',
  serialize: coerceInt,
  parseValue: coerceInt,
  parseLiteral: function parseLiteral(ast) {
    if (ast.kind === _kinds.Kind.INT) {
      var num = parseInt(ast.value, 10);

      if (num <= MAX_INT && num >= MIN_INT) {
        return num;
      }
    }

    return undefined;
  }
});
exports.GraphQLInt = GraphQLInt;

function coerceFloat(value) {
  if (Array.isArray(value)) {
    throw new TypeError("Float cannot represent an array value: [".concat(String(value), "]"));
  }

  if (value === '') {
    throw new TypeError('Float cannot represent non numeric value: (empty string)');
  }

  var num = Number(value);

  if (isFinite(num)) {
    return num;
  }

  throw new TypeError('Float cannot represent non numeric value: ' + (0, _inspect.default)(value));
}

var GraphQLFloat = new _definition.GraphQLScalarType({
  name: 'Float',
  description: 'The `Float` scalar type represents signed double-precision fractional ' + 'values as specified by ' + '[IEEE 754](http://en.wikipedia.org/wiki/IEEE_floating_point). ',
  serialize: coerceFloat,
  parseValue: coerceFloat,
  parseLiteral: function parseLiteral(ast) {
    return ast.kind === _kinds.Kind.FLOAT || ast.kind === _kinds.Kind.INT ? parseFloat(ast.value) : undefined;
  }
});
exports.GraphQLFloat = GraphQLFloat;

function coerceString(value) {
  if (Array.isArray(value)) {
    throw new TypeError("String cannot represent an array value: ".concat((0, _inspect.default)(value)));
  }

  return String(value);
}

var GraphQLString = new _definition.GraphQLScalarType({
  name: 'String',
  description: 'The `String` scalar type represents textual data, represented as UTF-8 ' + 'character sequences. The String type is most often used by GraphQL to ' + 'represent free-form human-readable text.',
  serialize: coerceString,
  parseValue: coerceString,
  parseLiteral: function parseLiteral(ast) {
    return ast.kind === _kinds.Kind.STRING ? ast.value : undefined;
  }
});
exports.GraphQLString = GraphQLString;

function coerceBoolean(value) {
  if (Array.isArray(value)) {
    throw new TypeError("Boolean cannot represent an array value: [".concat(String(value), "]"));
  }

  return Boolean(value);
}

var GraphQLBoolean = new _definition.GraphQLScalarType({
  name: 'Boolean',
  description: 'The `Boolean` scalar type represents `true` or `false`.',
  serialize: coerceBoolean,
  parseValue: coerceBoolean,
  parseLiteral: function parseLiteral(ast) {
    return ast.kind === _kinds.Kind.BOOLEAN ? ast.value : undefined;
  }
});
exports.GraphQLBoolean = GraphQLBoolean;
var GraphQLID = new _definition.GraphQLScalarType({
  name: 'ID',
  description: 'The `ID` scalar type represents a unique identifier, often used to ' + 'refetch an object or as key for a cache. The ID type appears in a JSON ' + 'response as a String; however, it is not intended to be human-readable. ' + 'When expected as an input type, any string (such as `"4"`) or integer ' + '(such as `4`) input value will be accepted as an ID.',
  serialize: coerceString,
  parseValue: coerceString,
  parseLiteral: function parseLiteral(ast) {
    return ast.kind === _kinds.Kind.STRING || ast.kind === _kinds.Kind.INT ? ast.value : undefined;
  }
});
exports.GraphQLID = GraphQLID;
var specifiedScalarTypes = [GraphQLString, GraphQLInt, GraphQLFloat, GraphQLBoolean, GraphQLID];
exports.specifiedScalarTypes = specifiedScalarTypes;

function isSpecifiedScalarType(type) {
  return (0, _definition.isNamedType)(type) && ( // Would prefer to use specifiedScalarTypes.some(), however %checks needs
  // a simple expression.
  type.name === GraphQLString.name || type.name === GraphQLInt.name || type.name === GraphQLFloat.name || type.name === GraphQLBoolean.name || type.name === GraphQLID.name);
}