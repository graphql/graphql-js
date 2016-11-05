/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { GraphQLScalarType } from './definition';
import * as Kind from '../language/kinds';
import moment from 'moment';

// As per the GraphQL Spec, Integers are only treated as valid when a valid
// 32-bit signed integer, providing the broadest support across platforms.
//
// n.b. JavaScript's integers are safe between -(2^53 - 1) and 2^53 - 1 because
// they are internally represented as IEEE 754 doubles.
const MAX_INT = 2147483647;
const MIN_INT = -2147483648;

// All the allowed ISO 8601 date-time formats used in the
// GraphQLDateTime scalar.
const ISO_8601_FORMAT = [
  'YYYY',
  'YYYY-MM',
  'YYYY-MM-DD',
  'YYYYMMDD',
  'YYYY-MM-DDTHHZ',
  'YYYY-MM-DDTHH:mmZ',
  'YYYY-MM-DDTHHmmZ',
  'YYYY-MM-DDTHH:mm:ssZ',
  'YYYY-MM-DDTHHmmssZ',
  'YYYY-MM-DDTHH:mm:ss.SSSZ',
  'YYYY-MM-DDTHHmmss.SSSZ',
  'YYYY-[W]WW',
  'YYYY[W]WW',
  'YYYY-[W]WW-E',
  'YYYY[W]WWE',
  'YYYY-DDDD',
  'YYYYDDDD'
];

function coerceInt(value: mixed): ?number {
  if (value === '') {
    throw new TypeError(
      'Int cannot represent non 32-bit signed integer value: (empty string)'
    );
  }
  const num = Number(value);
  if (num === num && num <= MAX_INT && num >= MIN_INT) {
    return (num < 0 ? Math.ceil : Math.floor)(num);
  }
  throw new TypeError(
    'Int cannot represent non 32-bit signed integer value: ' + String(value)
  );
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

export const GraphQLString = new GraphQLScalarType({
  name: 'String',
  description:
    'The `String` scalar type represents textual data, represented as UTF-8 ' +
    'character sequences. The String type is most often used by GraphQL to ' +
    'represent free-form human-readable text.',
  serialize: String,
  parseValue: String,
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

export const GraphQLDateTime = new GraphQLScalarType({
  name: 'DateTime',
  description: 'An ISO-8601 encoded UTC date string.',
  serialize(value: mixed): string {
    if (!(value instanceof Date)) {
      throw new TypeError(
        'DateTime cannot be serialized from a non Date type ' + String(value)
      );
    }
    const momentDate = moment.utc(value);
    if (momentDate.isValid()) {
      return momentDate.toISOString();
    }
    throw new TypeError(
      'DateTime cannot represent an invalid date ' + String(value)
    );
  },
  parseValue(value: mixed): Date {
    if (!(typeof value === 'string' || value instanceof String)) {
      throw new TypeError(
        'DateTime cannot represent non string type ' + String(value)
      );
    }
    const momentDate = moment.utc(value, ISO_8601_FORMAT, true);
    if (momentDate.isValid()) {
      return momentDate.toDate();
    }
    throw new TypeError(
      'DateTime cannot represent an invalid ISO 8601 date ' + String(value)
    );
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      const momentDate = moment.utc(ast.value, ISO_8601_FORMAT, true);
      if (momentDate.isValid()) {
        return momentDate.toDate();
      }
    }
    return null;
  }
});
