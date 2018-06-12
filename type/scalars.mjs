/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */
import inspect from '../jsutils/inspect';
import isInteger from '../jsutils/isInteger';
import { GraphQLScalarType, isNamedType } from './definition';
import { Kind } from '../language/kinds'; // As per the GraphQL Spec, Integers are only treated as valid when a valid
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

  if (!isInteger(num)) {
    throw new TypeError('Int cannot represent non-integer value: ' + inspect(value));
  }

  if (num > MAX_INT || num < MIN_INT) {
    throw new TypeError('Int cannot represent non 32-bit signed integer value: ' + inspect(value));
  }

  return num;
}

export var GraphQLInt = new GraphQLScalarType({
  name: 'Int',
  description: 'The `Int` scalar type represents non-fractional signed whole numeric ' + 'values. Int can represent values between -(2^31) and 2^31 - 1. ',
  serialize: coerceInt,
  parseValue: coerceInt,
  parseLiteral: function parseLiteral(ast) {
    if (ast.kind === Kind.INT) {
      var num = parseInt(ast.value, 10);

      if (num <= MAX_INT && num >= MIN_INT) {
        return num;
      }
    }

    return undefined;
  }
});

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

  throw new TypeError('Float cannot represent non numeric value: ' + inspect(value));
}

export var GraphQLFloat = new GraphQLScalarType({
  name: 'Float',
  description: 'The `Float` scalar type represents signed double-precision fractional ' + 'values as specified by ' + '[IEEE 754](http://en.wikipedia.org/wiki/IEEE_floating_point). ',
  serialize: coerceFloat,
  parseValue: coerceFloat,
  parseLiteral: function parseLiteral(ast) {
    return ast.kind === Kind.FLOAT || ast.kind === Kind.INT ? parseFloat(ast.value) : undefined;
  }
});

function coerceString(value) {
  if (Array.isArray(value)) {
    throw new TypeError("String cannot represent an array value: ".concat(inspect(value)));
  }

  return String(value);
}

export var GraphQLString = new GraphQLScalarType({
  name: 'String',
  description: 'The `String` scalar type represents textual data, represented as UTF-8 ' + 'character sequences. The String type is most often used by GraphQL to ' + 'represent free-form human-readable text.',
  serialize: coerceString,
  parseValue: coerceString,
  parseLiteral: function parseLiteral(ast) {
    return ast.kind === Kind.STRING ? ast.value : undefined;
  }
});

function coerceBoolean(value) {
  if (Array.isArray(value)) {
    throw new TypeError("Boolean cannot represent an array value: [".concat(String(value), "]"));
  }

  return Boolean(value);
}

export var GraphQLBoolean = new GraphQLScalarType({
  name: 'Boolean',
  description: 'The `Boolean` scalar type represents `true` or `false`.',
  serialize: coerceBoolean,
  parseValue: coerceBoolean,
  parseLiteral: function parseLiteral(ast) {
    return ast.kind === Kind.BOOLEAN ? ast.value : undefined;
  }
});
export var GraphQLID = new GraphQLScalarType({
  name: 'ID',
  description: 'The `ID` scalar type represents a unique identifier, often used to ' + 'refetch an object or as key for a cache. The ID type appears in a JSON ' + 'response as a String; however, it is not intended to be human-readable. ' + 'When expected as an input type, any string (such as `"4"`) or integer ' + '(such as `4`) input value will be accepted as an ID.',
  serialize: coerceString,
  parseValue: coerceString,
  parseLiteral: function parseLiteral(ast) {
    return ast.kind === Kind.STRING || ast.kind === Kind.INT ? ast.value : undefined;
  }
});
export var specifiedScalarTypes = [GraphQLString, GraphQLInt, GraphQLFloat, GraphQLBoolean, GraphQLID];
export function isSpecifiedScalarType(type) {
  return isNamedType(type) && ( // Would prefer to use specifiedScalarTypes.some(), however %checks needs
  // a simple expression.
  type.name === GraphQLString.name || type.name === GraphQLInt.name || type.name === GraphQLFloat.name || type.name === GraphQLBoolean.name || type.name === GraphQLID.name);
}