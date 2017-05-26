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

/**
 * Function that validates whether a date-time string
 * is valid according to the RFC 3339 specification.
 */
function isValidDate(dateTime: string): boolean {
  /* eslint-disable max-len*/
  const RFC_3339_REGEX = /^(\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]|60))(\.\d{1,})?(([Z])|([+|-]([01][0-9]|2[0-3]):[0-5][0-9]))$/;

  if (!RFC_3339_REGEX.test(dateTime)) {
    return false;
  }
  // Check if it is a valid Date.
  // Note, according to RFC 3339 2016-02-01T00:00:60Z is a valid date-time string.
  // However, it is considered invalid when parsed by the javascript
  // Date class because it ignores leap seconds.
  // Therefore, this implementation also ignores leap seconds.
  const time = Date.parse(dateTime);
  if (time !== time) {
    return false;
  }

  // Check whether a certain year is a leap year.
  //
  // Every year that is exactly divisible by four
  // is a leap year, except for years that are exactly
  // divisible by 100, but these centurial years are
  // leap years if they are exactly divisible by 400.
  // For example, the years 1700, 1800, and 1900 are not leap years,
  // but the years 1600 and 2000 are.
  const leapYear = year => {
    return ((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0);
  };

  const year = Number(dateTime.substr(0, 4));
  const month = Number(dateTime.substr(5, 2));
  const day = Number(dateTime.substr(8, 2));

  // Month Number  Month/Year           Maximum value of date-mday
  // ------------  ----------           --------------------------
  // 01            January              31
  // 02            February, normal     28
  // 02            February, leap year  29
  // 03            March                31
  // 04            April                30
  // 05            May                  31
  // 06            June                 30
  // 07            July                 31
  // 08            August               31
  // 09            September            30
  // 10            October              31
  // 11            November             30
  // 12            December             31
  switch (month) {
    case 2: // February
      if (leapYear(year) && day > 29) {
        return false;
      } else if (!leapYear(year) && day > 28) {
        return false;
      }
      return true;
    case 4: // April
    case 6: // June
    case 9: // September
    case 11: // November
      if (day > 30) {
        return false;
      }
      break;
  }
  return true;
}

export const GraphQLDateTime = new GraphQLScalarType({
  name: 'DateTime',
  description:
    'The `DateTime` scalar represents a timestamp, ' +
    'represented as a string serialized date-time conforming to the '+
    'RFC 3339(https://www.ietf.org/rfc/rfc3339.txt) profile of the ' +
    'ISO 8601 standard for representation of dates and times using the ' +
    'Gregorian calendar.',
  serialize(value: mixed): string {
    if (value instanceof Date) {
      const time = value.getTime();
      if (time === time) {
        return value.toISOString();
      }
      throw new TypeError('DateTime cannot represent an invalid Date instance');
    } else if (typeof value === 'string' || value instanceof String) {
      if (isValidDate(value)) {
        return value;
      }
      throw new TypeError(
        'DateTime cannot represent an invalid date-time string ' + value
      );
    } else if (typeof value === 'number' || value instanceof Number) {
      // Serialize from Unix timestamp: the number of
      // seconds since 1st Jan 1970.

      // Unix timestamp are 32-bit signed integers
      if (value === value && value <= MAX_INT && value >= MIN_INT) {
        // Date represents unix time as the number of
        // milliseconds since 1st Jan 1970 therefore we
        // need to perform a conversion.
        const date = new Date(value * 1000);
        return date.toISOString();
      }
      throw new TypeError(
        'DateTime cannot represent an invalid Unix timestamp ' + value
      );
    } else {
      throw new TypeError(
        'DateTime cannot be serialized from a non string, ' +
        'non numeric or non Date type ' + String(value)
      );
    }
  },
  parseValue(value: mixed): Date {
    if (!(typeof value === 'string' || value instanceof String)) {
      throw new TypeError(
        'DateTime cannot represent non string type ' + String(value)
      );
    }
    if (isValidDate(value)) {
      return new Date(value);
    }
    throw new TypeError(
      'DateTime cannot represent an invalid date-time string ' + value
    );
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      if (isValidDate(ast.value)) {
        return new Date(ast.value);
      }
    }
    return null;
  }
});
