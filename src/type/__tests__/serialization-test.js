/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
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

const invalidDateTime = [
  'Invalid date',
  // invalid structure
  '2016-02-01T00Z',
  // omission of seconds
  '2016-02-01T00:00Z',
  // omission of colon
  '2016-02-01T000059Z',
  // omission of time-offset
  '2016-02-01T00:00:00',
  // seconds should be two characters
  '2016-02-01T00:00:0Z',
  // nonexistent date
  '2015-02-29T00:00:00Z',
  // hour 24 is not allowed in RFC 3339
  '2016-01-01T24:00:00Z',
  // nonexistent date
  '2016-04-31T00:00:00Z',
  // nonexistent date
  '2016-06-31T00:00:00Z',
  // nonexistent date
  '2016-09-31T00:00:00Z',
  // nonexistent date
  '2016-11-31T00:00:00Z',
  // month ranges from 01-12
  '2016-13-01T00:00:00Z',
  // minute ranges from 00-59
  '2016-01-01T00:60:00Z',
  // According to RFC 3339 2016-02-01T00:00:60Z is a valid date-time string.
  // However, it is considered invalid when parsed by the javascript
  // Date class because it ignores leap seconds.
  // Therefore, this implementation also ignores leap seconds.
  '2016-02-01T00:00:60Z',
  // must specify a fractional second
  '2015-02-26T00:00:00.Z',
  // must add colon in time-offset
  '2017-01-07T11:25:00+0100',
  // omission of minute in time-offset
  '2017-01-07T11:25:00+01',
  // omission of minute in time-offset
  '2017-01-07T11:25:00+',
  // hour ranges from 00-23
  '2017-01-01T00:00:00+24:00',
  // minute ranges from 00-59
  '2017-01-01T00:00:00+00:60'
];

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
      GraphQLInt.serialize(1e5)
    ).to.equal(100000);
    // The GraphQL specification does not allow serializing non-integer values
    // as Int to avoid accidental data loss.
    expect(() =>
      GraphQLInt.serialize(0.1)
    ).to.throw(
      'Int cannot represent non-integer value: 0.1'
    );
    expect(() =>
      GraphQLInt.serialize(1.1)
    ).to.throw(
      'Int cannot represent non-integer value: 1.1'
    );
    expect(() =>
      GraphQLInt.serialize(-1.1)
    ).to.throw(
      'Int cannot represent non-integer value: -1.1'
    );
    expect(() =>
      GraphQLInt.serialize('-1.1')
    ).to.throw(
      'Int cannot represent non-integer value: -1.1'
    );
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
    expect(() =>
      GraphQLInt.serialize(NaN)
    ).to.throw(
      'Int cannot represent non 32-bit signed integer value: NaN'
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

  describe('serializes output DateTime', () => {

    [
      {},
      [],
      null,
      undefined,
      true,
    ].forEach(invalidInput => {
      it(`throws serializing ${invalidInput}`, () => {
        expect(() =>
          GraphQLDateTime.serialize(invalidInput)
        ).to.throw(
          'DateTime cannot be serialized from a non string, ' +
          'non numeric or non Date type ' + invalidInput
        );
      });
    });

    [
      [
        new Date(Date.UTC(2016, 0, 1)),
        '2016-01-01T00:00:00.000Z'
      ],
      [
        new Date(Date.UTC(2016, 0, 1, 14, 48, 10, 3)),
        '2016-01-01T14:48:10.003Z'
      ],
      [
        new Date(Date.UTC(2016, 0, 1, 24, 0)),
        '2016-01-02T00:00:00.000Z'
      ]
    ].forEach(([ value, expected ]) => {
      it(`serializes Date ${value} into date-time string ${expected}`, () => {
        expect(
          GraphQLDateTime.serialize(value)
        ).to.equal(expected);
      });
    });

    it('throws serializing an invalid Date', () => {
      expect(() =>
        GraphQLDateTime.serialize(new Date('invalid date'))
      ).to.throw(
        'DateTime cannot represent an invalid Date instance'
      );
    });

    [
      '2016-02-01T00:00:00Z',
      '2016-02-01T00:00:59Z',
      '2016-02-01T00:00:00-11:00',
      '2017-01-07T11:25:00+01:00',
      '2017-01-07T00:00:00+01:00',
      '2017-01-07T00:00:00.0Z',
      '2017-01-01T00:00:00.0+01:00',
      '2016-02-01T00:00:00.450Z',
      '2017-01-01T10:23:11.45686664Z',
      '2017-01-01T10:23:11.23545654+01:00'
    ].forEach(value => {
      it(`serializes date-time string ${value}`, () => {
        expect(
          GraphQLDateTime.serialize(value)
        ).to.equal(value);
      });
    });

    invalidDateTime.forEach(dateString => {
      it(`throws serializing invalid date-time string ${dateString}`, () => {
        expect(() =>
          GraphQLDateTime.serialize(dateString)
        ).to.throw(
          'DateTime cannot represent an invalid ' +
          'date-time string ' + dateString
        );
      });
    });

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
      it(
        `serializes unix timestamp ${value} into date-time string ${expected}`
      , () => {
        expect(
          GraphQLDateTime.serialize(value)
        ).to.equal(expected);
      });
    });

    [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      // assume Unix timestamp are 32-bit
      2147483648,
      -2147483649
    ].forEach(value => {
      it(`throws serializing invalid unix timestamp ${value}`, () => {
        expect(() =>
          GraphQLDateTime.serialize(value)
        ).to.throw(
          'DateTime cannot represent an invalid Unix timestamp ' + value
        );
      });
    });
  });

  describe('parses input DateTime', () => {

    [
      [
        '2016-02-01T00:00:00Z', new Date(Date.UTC(2016, 1, 1, 0, 0, 0)) ],
      [ '2016-02-01T00:00:15Z', new Date(Date.UTC(2016, 1, 1, 0, 0, 15)) ],
      [ '2016-02-01T00:00:59Z', new Date(Date.UTC(2016, 1, 1, 0, 0, 59)) ],
      [ '2016-02-01T00:00:00-11:00', new Date(Date.UTC(2016, 1, 1, 11)) ],
      [ '2017-01-07T11:25:00+01:00', new Date(Date.UTC(2017, 0, 7, 10, 25)) ],
      [ '2017-01-07T00:00:00+01:00', new Date(Date.UTC(2017, 0, 6, 23)) ],
      [
        '2016-02-01T00:00:00.12Z',
        new Date(Date.UTC(2016, 1, 1, 0, 0, 0, 120))
      ],
      [
        '2016-02-01T00:00:00.123456Z',
        new Date(Date.UTC(2016, 1, 1, 0, 0, 0, 123))
      ],
      [
        '2016-02-01T00:00:00.12399Z',
        new Date(Date.UTC(2016, 1, 1, 0, 0, 0, 123))
      ],
      [
        '2016-02-01T00:00:00.000Z',
        new Date(Date.UTC(2016, 1, 1, 0, 0, 0, 0))
      ],
      [
        '2016-02-01T00:00:00.993Z',
        new Date(Date.UTC(2016, 1, 1, 0, 0, 0, 993))
      ],
      [
        '2017-01-07T11:25:00.450+01:00',
        new Date(Date.UTC(2017, 0, 7, 10, 25, 0, 450))
      ],
      [
        // eslint-disable-next-line no-new-wrappers
        new String('2017-01-07T11:25:00.450+01:00'),
        new Date(Date.UTC(2017, 0, 7, 10, 25, 0, 450))
      ]
    ].forEach(([ value, expected ]) => {
      it(`parses date-time string ${value} into Date ${expected}`, () => {
        expect(
          GraphQLDateTime.parseValue(value).toISOString()
        ).to.equal(expected.toISOString());
      });
    });

    [
      null,
      undefined,
      4566,
      {},
      [],
      true,
    ].forEach(invalidInput => {
      it(`throws parsing ${String(invalidInput)}`, () => {
        expect(() =>
          GraphQLDateTime.parseValue(invalidInput)
        ).to.throw(
          'DateTime cannot represent non string type ' + invalidInput
        );
      });
    });

    invalidDateTime.forEach(dateString => {
      it(`throws parsing invalid date-time string ${dateString}`, () => {
        expect(() =>
          GraphQLDateTime.parseValue(dateString)
        ).to.throw(
          'DateTime cannot represent an invalid ' +
          'date-time string ' + dateString
        );
      });
    });
  });

  describe('parses literal DateTime', () => {

    [
      [
        '2016-02-01T00:00:00Z', new Date(Date.UTC(2016, 1, 1, 0, 0, 0)) ],
      [ '2016-02-01T00:00:59Z', new Date(Date.UTC(2016, 1, 1, 0, 0, 59)) ],
      [ '2016-02-01T00:00:00-11:00', new Date(Date.UTC(2016, 1, 1, 11)) ],
      [ '2017-01-07T11:25:00+01:00', new Date(Date.UTC(2017, 0, 7, 10, 25)) ],
      [ '2017-01-07T00:00:00+01:00', new Date(Date.UTC(2017, 0, 6, 23)) ],
      [
        '2016-02-01T00:00:00.12Z',
        new Date(Date.UTC(2016, 1, 1, 0, 0, 0, 120))
      ],
      [
        // rounds down the fractional seconds to 3 decimal places.
        '2016-02-01T00:00:00.123456Z',
        new Date(Date.UTC(2016, 1, 1, 0, 0, 0, 123))
      ],
      [
        // rounds down the fractional seconds to 3 decimal places.
        '2016-02-01T00:00:00.12399Z',
        new Date(Date.UTC(2016, 1, 1, 0, 0, 0, 123))
      ],
      [
        '2017-01-07T11:25:00.450+01:00',
        new Date(Date.UTC(2017, 0, 7, 10, 25, 0, 450))
      ]
    ].forEach(([ value, expected ]) => {
      const literal = {
        kind: Kind.STRING,
        value
      };

      it(
        `parses literal ${JSON.stringify(literal)} into Date ${expected}`,
        () => {
          const parsed = GraphQLDateTime.parseLiteral({
            kind: Kind.STRING, value
          });
          expect(parsed.getTime()).to.equal(expected.getTime());
        });
    });

    invalidDateTime.forEach(value => {
      const literal = {
        kind: Kind.STRING, value
      };
      it(`returns null for invalid literal ${JSON.stringify(literal)}`, () => {
        expect(
          GraphQLDateTime.parseLiteral(literal)
        ).to.equal(null);
      });
    });

    it('returns null for invalid kind', () => {
      expect(
        GraphQLDateTime.parseLiteral({
          kind: Kind.FLOAT, value: 5
        })
      ).to.equal(null);
    });
  });
});
