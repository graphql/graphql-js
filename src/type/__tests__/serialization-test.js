/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import {
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLBoolean,
  GraphQLDateTime,
} from '../';

import { describe, it } from 'mocha';
import { expect } from 'chai';
import * as Kind from '../../language/kinds';

describe('Type System: Scalar coercion', () => {
  it('serializes output int', () => {
    expect(
      GraphQLInt.serialize(1)
    ).to.equal(1);
    expect(
      GraphQLInt.serialize('123')
    ).to.equal(123);
    expect(
      GraphQLInt.serialize(0)
    ).to.equal(0);
    expect(
      GraphQLInt.serialize(-1)
    ).to.equal(-1);
    expect(
      GraphQLInt.serialize(0.1)
    ).to.equal(0);
    expect(
      GraphQLInt.serialize(1.1)
    ).to.equal(1);
    expect(
      GraphQLInt.serialize(-1.1)
    ).to.equal(-1);
    expect(
      GraphQLInt.serialize(1e5)
    ).to.equal(100000);
    // Maybe a safe JavaScript int, but bigger than 2^32, so not
    // representable as a GraphQL Int
    expect(() =>
      GraphQLInt.serialize(9876504321)
    ).to.throw(
      'Int cannot represent non 32-bit signed integer value: 9876504321'
    );
    expect(() =>
      GraphQLInt.serialize(-9876504321)
    ).to.throw(
      'Int cannot represent non 32-bit signed integer value: -9876504321'
    );
    // Too big to represent as an Int in JavaScript or GraphQL
    expect(() =>
      GraphQLInt.serialize(1e100)
    ).to.throw(
      'Int cannot represent non 32-bit signed integer value: 1e+100'
    );
    expect(() =>
      GraphQLInt.serialize(-1e100)
    ).to.throw(
      'Int cannot represent non 32-bit signed integer value: -1e+100'
    );
    expect(
      GraphQLInt.serialize('-1.1')
    ).to.equal(-1);
    expect(() =>
      GraphQLInt.serialize('one')
    ).to.throw(
      'Int cannot represent non 32-bit signed integer value: one'
    );
    expect(
      GraphQLInt.serialize(false)
    ).to.equal(0);
    expect(
      GraphQLInt.serialize(true)
    ).to.equal(1);
    expect(() =>
      GraphQLInt.serialize('')
    ).to.throw(
      'Int cannot represent non 32-bit signed integer value: (empty string)'
    );
  });

  it('serializes output float', () => {
    expect(
      GraphQLFloat.serialize(1)
    ).to.equal(1.0);
    expect(
      GraphQLFloat.serialize(0)
    ).to.equal(0.0);
    expect(
      GraphQLFloat.serialize('123.5')
    ).to.equal(123.5);
    expect(
      GraphQLFloat.serialize(-1)
    ).to.equal(-1.0);
    expect(
      GraphQLFloat.serialize(0.1)
    ).to.equal(0.1);
    expect(
      GraphQLFloat.serialize(1.1)
    ).to.equal(1.1);
    expect(
      GraphQLFloat.serialize(-1.1)
    ).to.equal(-1.1);
    expect(
      GraphQLFloat.serialize('-1.1')
    ).to.equal(-1.1);
    expect(
      GraphQLFloat.serialize(false)
    ).to.equal(0.0);
    expect(
      GraphQLFloat.serialize(true)
    ).to.equal(1.0);

    expect(() =>
      GraphQLFloat.serialize(NaN)
    ).to.throw(
      'Float cannot represent non numeric value: NaN'
    );

    expect(() =>
      GraphQLFloat.serialize('one')
    ).to.throw(
      'Float cannot represent non numeric value: one'
    );

    expect(() =>
      GraphQLFloat.serialize('')
    ).to.throw(
      'Float cannot represent non numeric value: (empty string)'
    );
  });

  it('serializes output strings', () => {
    expect(
      GraphQLString.serialize('string')
    ).to.equal('string');
    expect(
      GraphQLString.serialize(1)
    ).to.equal('1');
    expect(
      GraphQLString.serialize(-1.1)
    ).to.equal('-1.1');
    expect(
      GraphQLString.serialize(true)
    ).to.equal('true');
    expect(
      GraphQLString.serialize(false)
    ).to.equal('false');
  });

  it('serializes output boolean', () => {
    expect(
      GraphQLBoolean.serialize('string')
    ).to.equal(true);
    expect(
      GraphQLBoolean.serialize('')
    ).to.equal(false);
    expect(
      GraphQLBoolean.serialize(1)
    ).to.equal(true);
    expect(
      GraphQLBoolean.serialize(0)
    ).to.equal(false);
    expect(
      GraphQLBoolean.serialize(true)
    ).to.equal(true);
    expect(
      GraphQLBoolean.serialize(false)
    ).to.equal(false);
  });

  it('serializes output DateTime', () => {

    [
      {},
      [],
      null,
      undefined,
      true,
    ].forEach(invalidInput => {
      expect(() =>
        GraphQLDateTime.serialize(invalidInput)
      ).to.throw(
        'DateTime cannot be serialized from a non string, ' +
        'non numeric or non Date type ' + invalidInput
      );
    });

    // Serialize from Date
    [
      [ new Date(Date.UTC(2016, 0, 1)), '2016-01-01T00:00:00.000Z' ],
      [
        new Date(Date.UTC(2016, 0, 1, 14, 48, 10, 3)),
        '2016-01-01T14:48:10.003Z'
      ],
    ].forEach(([ value, expected ]) => {
      expect(
        GraphQLDateTime.serialize(value)
      ).to.equal(expected);
    });

    expect(() =>
      GraphQLDateTime.serialize(new Date('invalid date'))
    ).to.throw(
      'DateTime cannot represent an invalid Date instance'
    );

    // Serializes from date string
    [
      // Years
      '2016',
      // Years and month
      '2016-01',
      '2016-11',
      // Date
      '2016-02-01',
      '2016-09-15',
      '2016-01-31',
      // Date with 30 days in the month
      '2016-04-30',
      '2016-06-30',
      '2016-09-30',
      '2016-11-30',
      // Date leap year checks
      '2016-02-29',
      '2000-02-29',
      // Datetime with hours and minutes
      '2016-02-01T00:00Z',
      '2016-02-01T24:00Z',
      '2016-02-01T23:59Z',
      '2016-02-01T15:32Z',
      // Datetime with hours, minutes and seconds
      '2016-02-01T00:00:00Z',
      '2016-02-01T00:00:15Z',
      '2016-02-01T00:00:59Z',
      // Datetime with hours, minutes, seconds and milliseconds
      '2016-02-01T00:00:00.000Z',
      '2016-02-01T00:00:00.999Z',
      '2016-02-01T00:00:00.456Z',
    ].forEach(value => {
      expect(
        GraphQLDateTime.serialize(value)
      ).to.equal(value);
    });

    [
      // General
      'Invalid date',
      // Year and month
      '2016-00',
      '2016-13',
      '2016-1',
      '201613',
      // Date
      '2016-01-00',
      '2016-01-32',
      '2016-01-1',
      '20160101',
      // Date leap year checks
      '2015-02-29',
      '2015-02-30',
      '1900-02-29',
      '1900-02-30',
      '2016-02-30',
      '2000-02-30',
      // Datetime with hours and minutes
      '2016-02-01T24:01Z',
      '2016-02-01T00:60Z',
      '2016-02-01T0:60Z',
      '2016-02-01T00:0Z',
      '2015-02-29T00:00Z',
      '2016-02-01T0000',
      // Datetime with hours, minutes and seconds
      '2016-02-01T000059Z',
      '2016-02-01T00:00:60Z',
      '2016-02-01T00:00:0Z',
      '2015-02-29T00:00:00Z',
      '2016-02-01T00:00:00',
      // Datetime with hours, minutes, seconds and milliseconds
      '2016-02-01T00:00:00.1Z',
      '2016-02-01T00:00:00.22Z',
      '2015-02-29T00:00:00.000Z',
      '2016-02-01T00:00:00.223',
    ].forEach(dateString => {
      expect(() =>
        GraphQLDateTime.serialize(dateString)
      ).to.throw(
        'DateTime cannot represent an invalid ISO 8601' +
        ' date string ' + dateString
      );
    });

    // Serializes Unix timestamp
    [
      [ 854325678, '1997-01-27T00:41:18.000Z' ],
      [ 876535, '1970-01-11T03:28:55.000Z' ],
      [ 876535.8, '1970-01-11T03:28:55.800Z' ],
      [ 876535.8321, '1970-01-11T03:28:55.832Z' ],
      [ -876535.8, '1969-12-21T20:31:04.200Z' ],
      // The maximum representable unix timestamp
      [ 2147483647, '2038-01-19T03:14:07.000Z' ],
      // The minimum representable unit timestamp
      [ -2147483648, '1901-12-13T20:45:52.000Z' ],
    ].forEach(([ value, expected ]) => {
      expect(
        GraphQLDateTime.serialize(value)
      ).to.equal(expected);
    });

    [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      // assume Unix timestamp are 32-bit
      2147483648,
      -2147483649
    ].forEach(value => {
      expect(() =>
        GraphQLDateTime.serialize(value)
      ).to.throw(
        'DateTime cannot represent an invalid Unix timestamp ' + value
      );
    });
  });

  it('parses input DateTime', () => {

    [
      // Years
      [ '2016', new Date(Date.UTC(2016, 0)) ],
      // Years and month
      [ '2016-01', new Date(Date.UTC(2016, 0)) ],
      [ '2016-11', new Date(Date.UTC(2016, 10)) ],
      // Date
      [ '2016-02-01', new Date(Date.UTC(2016, 1, 1)) ],
      [ '2016-09-15', new Date(Date.UTC(2016, 8, 15)) ],
      [ '2016-01-31', new Date(Date.UTC(2016, 0, 31)) ],
      // Date with 30 days in the month
      [ '2016-04-30', new Date(Date.UTC(2016, 3, 30)) ],
      [ '2016-06-30', new Date(Date.UTC(2016, 5, 30)) ],
      [ '2016-09-30', new Date(Date.UTC(2016, 8, 30)) ],
      [ '2016-11-30', new Date(Date.UTC(2016, 10, 30)) ],
      // Date leap year checks
      [ '2016-02-29', new Date(Date.UTC(2016, 1, 29)) ],
      [ '2000-02-29', new Date(Date.UTC(2000, 1, 29)) ],
      // Datetime with hours and minutes
      [ '2016-02-01T00:00Z', new Date(Date.UTC(2016, 1, 1, 0, 0)) ],
      [ '2016-02-01T24:00Z', new Date(Date.UTC(2016, 1, 2, 0, 0)) ],
      [ '2016-02-01T23:59Z', new Date(Date.UTC(2016, 1, 1, 23, 59)) ],
      [ '2016-02-01T15:32Z', new Date(Date.UTC(2016, 1, 1, 15, 32)) ],
      // Datetime with hours, minutes and seconds
      [ '2016-02-01T00:00:00Z', new Date(Date.UTC(2016, 1, 1, 0, 0, 0)) ],
      [ '2016-02-01T00:00:15Z', new Date(Date.UTC(2016, 1, 1, 0, 0, 15)) ],
      [ '2016-02-01T00:00:59Z', new Date(Date.UTC(2016, 1, 1, 0, 0, 59)) ],
      // Datetime with hours, minutes, seconds and milliseconds
      [
        '2016-02-01T00:00:00.000Z',
        new Date(Date.UTC(2016, 1, 1, 0, 0, 0, 0))
      ],
      [
        '2016-02-01T00:00:00.999Z',
        new Date(Date.UTC(2016, 1, 1, 0, 0, 0, 999))
      ],
      [
        '2016-02-01T00:00:00.456Z',
        new Date(Date.UTC(2016, 1, 1, 0, 0, 0, 456))
      ],
    ].forEach(([ value, expected ]) => {
      expect(
        GraphQLDateTime.parseValue(value).toISOString()
      ).to.equal(expected.toISOString());
    });

    [
      null,
      undefined,
      4566,
      {},
      [],
      true,
    ].forEach(invalidInput => {
      expect(() =>
        GraphQLDateTime.parseValue(invalidInput)
      ).to.throw(
        'DateTime cannot represent non string type ' + invalidInput
      );
    });

    [
      // General
      'Invalid date',
      // Year and month
      '2016-00',
      '2016-13',
      '2016-1',
      '201613',
      // Date
      '2016-01-00',
      '2016-01-32',
      '2016-01-1',
      '20160101',
      // Date leap year checks
      '2015-02-29',
      '2015-02-30',
      '1900-02-29',
      '1900-02-30',
      '2016-02-30',
      '2000-02-30',
      // Datetime with hours and minutes
      '2016-02-01T24:01Z',
      '2016-02-01T00:60Z',
      '2016-02-01T0:60Z',
      '2016-02-01T00:0Z',
      '2015-02-29T00:00Z',
      '2016-02-01T0000',
      // Datetime with hours, minutes and seconds
      '2016-02-01T000059Z',
      '2016-02-01T00:00:60Z',
      '2016-02-01T00:00:0Z',
      '2015-02-29T00:00:00Z',
      '2016-02-01T00:00:00',
      // Datetime with hours, minutes, seconds and milliseconds
      '2016-02-01T00:00:00.1Z',
      '2016-02-01T00:00:00.22Z',
      '2015-02-29T00:00:00.000Z',
      '2016-02-01T00:00:00.223',
    ].forEach(dateString => {
      expect(() =>
        GraphQLDateTime.parseValue(dateString)
      ).to.throw(
        'DateTime cannot represent an invalid ISO 8601 date ' + dateString
      );
    });
  });

  it('parses literal DateTime', () => {

    [
      // Years
      [ '2016', new Date(Date.UTC(2016, 0)) ],
      // Years and month
      [ '2016-01', new Date(Date.UTC(2016, 0)) ],
      [ '2016-11', new Date(Date.UTC(2016, 10)) ],
      // Date
      [ '2016-02-01', new Date(Date.UTC(2016, 1, 1)) ],
      [ '2016-09-15', new Date(Date.UTC(2016, 8, 15)) ],
      [ '2016-01-31', new Date(Date.UTC(2016, 0, 31)) ],
      // Date with 30 days in the month
      [ '2016-04-30', new Date(Date.UTC(2016, 3, 30)) ],
      [ '2016-06-30', new Date(Date.UTC(2016, 5, 30)) ],
      [ '2016-09-30', new Date(Date.UTC(2016, 8, 30)) ],
      [ '2016-11-30', new Date(Date.UTC(2016, 10, 30)) ],
      // Date leap year checks
      [ '2016-02-29', new Date(Date.UTC(2016, 1, 29)) ],
      [ '2000-02-29', new Date(Date.UTC(2000, 1, 29)) ],
      // Datetime with hours and minutes
      [ '2016-02-01T00:00Z', new Date(Date.UTC(2016, 1, 1, 0, 0)) ],
      [ '2016-02-01T24:00Z', new Date(Date.UTC(2016, 1, 2, 0, 0)) ],
      [ '2016-02-01T23:59Z', new Date(Date.UTC(2016, 1, 1, 23, 59)) ],
      [ '2016-02-01T15:32Z', new Date(Date.UTC(2016, 1, 1, 15, 32)) ],
      // Datetime with hours, minutes and seconds
      [ '2016-02-01T00:00:00Z', new Date(Date.UTC(2016, 1, 1, 0, 0, 0)) ],
      [ '2016-02-01T00:00:15Z', new Date(Date.UTC(2016, 1, 1, 0, 0, 15)) ],
      [ '2016-02-01T00:00:59Z', new Date(Date.UTC(2016, 1, 1, 0, 0, 59)) ],
      // Datetime with hours, minutes, seconds and milliseconds
      [
        '2016-02-01T00:00:00.000Z',
        new Date(Date.UTC(2016, 1, 1, 0, 0, 0, 0))
      ],
      [
        '2016-02-01T00:00:00.999Z',
        new Date(Date.UTC(2016, 1, 1, 0, 0, 0, 999))
      ],
      [
        '2016-02-01T00:00:00.456Z',
        new Date(Date.UTC(2016, 1, 1, 0, 0, 0, 456))
      ],
    ].forEach(([ value, expected ]) => {
      expect(
        GraphQLDateTime.parseLiteral({
          kind: Kind.STRING, value
        }).toISOString()
      ).to.equal(expected.toISOString());
    });

    [
      // General
      'Invalid date',
      // Year and month
      '2016-00',
      '2016-13',
      '2016-1',
      '201613',
      // Date
      '2016-01-00',
      '2016-01-32',
      '2016-01-1',
      '20160101',
      // Date leap year checks
      '2015-02-29',
      '2015-02-30',
      '1900-02-29',
      '1900-02-30',
      '2016-02-30',
      '2000-02-30',
      // Datetime with hours and minutes
      '2016-02-01T24:01Z',
      '2016-02-01T00:60Z',
      '2016-02-01T0:60Z',
      '2016-02-01T00:0Z',
      '2015-02-29T00:00Z',
      '2016-02-01T0000',
      // Datetime with hours, minutes and seconds
      '2016-02-01T000059Z',
      '2016-02-01T00:00:60Z',
      '2016-02-01T00:00:0Z',
      '2015-02-29T00:00:00Z',
      '2016-02-01T00:00:00',
      // Datetime with hours, minutes, seconds and milliseconds
      '2016-02-01T00:00:00.1Z',
      '2016-02-01T00:00:00.22Z',
      '2015-02-29T00:00:00.000Z',
      '2016-02-01T00:00:00.223',
    ].forEach(value => {
      expect(
        GraphQLDateTime.parseLiteral({
          kind: Kind.STRING, value
        })
      ).to.equal(null);
    });

    expect(
      GraphQLDateTime.parseLiteral({
        kind: Kind.FLOAT, value: 5
      })
    ).to.equal(null);
  });
});
