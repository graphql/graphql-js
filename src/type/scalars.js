/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import { GraphQLScalarType } from './definition';
import * as Kind from '../language/kinds';

// As per the GraphQL Spec, Integers are only treated as valid when a valid
// 32-bit signed integer, providing the broadest support across platforms.
//
// n.b. JavaScript's integers are safe between -(2^53 - 1) and 2^53 - 1 because
// they are internally represented as IEEE 754 doubles.
const MAX_INT = 2147483647;
const MIN_INT = -2147483648;

function coerceInt(value: mixed): ?number {
  if (value === '') {
    throw new TypeError(
      'Int cannot represent non 32-bit signed integer value: (empty string)'
    );
  }
  const num = Number(value);
  if (num !== num || num > MAX_INT || num < MIN_INT) {
    throw new TypeError(
      'Int cannot represent non 32-bit signed integer value: ' + String(value)
    );
  }
  const int = Math.floor(num);
  if (int !== num) {
    throw new TypeError(
      'Int cannot represent non-integer value: ' + String(value)
    );
  }
  return int;
}

export const GraphQLInt = new GraphQLScalarType({
  name: 'Int',
  description:
    'The `Int` scalar type represents non-fractional signed whole numeric ' +
    'values. Int can represent values between -(2^31) and 2^31 - 1. ',
  serialize: coerceInt,
  parseValue: coerceInt,
  parseLiteral(ast) {
    if (ast.kind === Kind.INT) {
      const num = parseInt(ast.value, 10);
      if (num <= MAX_INT && num >= MIN_INT) {
        return num;
      }
    }
    return null;
  }
});

function coerceFloat(value: mixed): ?number {
  if (value === '') {
    throw new TypeError(
      'Float cannot represent non numeric value: (empty string)'
    );
  }
  const num = Number(value);
  if (num === num) {
    return num;
  }
  throw new TypeError(
    'Float cannot represent non numeric value: ' + String(value)
  );
}

export const GraphQLFloat = new GraphQLScalarType({
  name: 'Float',
  description:
    'The `Float` scalar type represents signed double-precision fractional ' +
    'values as specified by ' +
    '[IEEE 754](http://en.wikipedia.org/wiki/IEEE_floating_point). ',
  serialize: coerceFloat,
  parseValue: coerceFloat,
  parseLiteral(ast) {
    return ast.kind === Kind.FLOAT || ast.kind === Kind.INT ?
      parseFloat(ast.value) :
      null;
  }
});

function coerceString(value: mixed): ?string {
  if (Array.isArray(value)) {
    throw new TypeError(
      `String cannot represent an array value: [${String(value)}]`
    );
  }
  return String(value);
}

export const GraphQLString = new GraphQLScalarType({
  name: 'String',
  description:
    'The `String` scalar type represents textual data, represented as UTF-8 ' +
    'character sequences. The String type is most often used by GraphQL to ' +
    'represent free-form human-readable text.',
  serialize: coerceString,
  parseValue: coerceString,
  parseLiteral(ast) {
    return ast.kind === Kind.STRING ? ast.value : null;
  }
});

export const GraphQLBoolean = new GraphQLScalarType({
  name: 'Boolean',
  description: 'The `Boolean` scalar type represents `true` or `false`.',
  serialize: Boolean,
  parseValue: Boolean,
  parseLiteral(ast) {
    return ast.kind === Kind.BOOLEAN ? ast.value : null;
  }
});

export const GraphQLID = new GraphQLScalarType({
  name: 'ID',
  description:
    'The `ID` scalar type represents a unique identifier, often used to ' +
    'refetch an object or as key for a cache. The ID type appears in a JSON ' +
    'response as a String; however, it is not intended to be human-readable. ' +
    'When expected as an input type, any string (such as `"4"`) or integer ' +
    '(such as `4`) input value will be accepted as an ID.',
  serialize: String,
  parseValue: String,
  parseLiteral(ast) {
    return ast.kind === Kind.STRING || ast.kind === Kind.INT ?
      ast.value :
      null;
  }
});
