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
* Function that checks whether a date string represents a valid date in
* the ISO 8601 formats:
* - YYYY
* - YYYY-MM
* - YYYY-MM-DD,
* - YYYY-MM-DDThh:mmZ
* - YYYY-MM-DDThh:mm:ssZ
* - YYYY-MM-DDThh:mm:ss.sssZ
*/
function isValidDate(datestring: string): boolean {

  // An array of regular expression containing the supported ISO 8601 formats
  const ISO_8601_REGEX = [
    /^\d{4}$/, // YYYY
    /^\d{4}-\d{2}$/, // YYYY-MM
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/, // YYYY-MM-DDThh:mmZ
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, // YYYY-MM-DDThh:mm:ssZ
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,// YYYY-MM-DDThh:mm:ss.sssZ
  ];

  // Validate the structure of the date-string
  if (!ISO_8601_REGEX.some(regex => regex.test(datestring))) {
    return false;
  }

  // Check if it is a correct date using the javascript Date parse() method.
  const time = Date.parse(datestring);
  if (time !== time) {
    return false;
  }

  // Perform specific checks for dates. We need
  // to make sure that the date string has the correct
  // number of days for a given month. This check is required
  // because the javascript Date.parse() assumes every month has 31 days.
  const regexYYYYMM = /\d{4}-\d{2}-\d{2}/;
  if (regexYYYYMM.test(datestring)) {
    const year = Number(datestring.substr(0,4));
    const month = Number(datestring.substr(5,2));
    const day = Number(datestring.substr(8,2));

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
      default:
        return true;
    }
  }
  // Every year that is exactly divisible by four
  // is a leap year, except for years that are exactly
  // divisible by 100, but these centurial years are
  // leap years if they are exactly divisible by 400.
  // For example, the years 1700, 1800, and 1900 are not leap years,
  // but the years 1600 and 2000 are.
  function leapYear(year) {
    return ((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0);
  }
  return true;
}

export const GraphQLDateTime = new GraphQLScalarType({
  name: 'DateTime',
  description: 'An ISO-8601 encoded UTC date string.',
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
        'DateTime cannot represent an invalid ISO 8601 date string ' + value
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
      'DateTime cannot represent an invalid ISO 8601 date ' + value
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
