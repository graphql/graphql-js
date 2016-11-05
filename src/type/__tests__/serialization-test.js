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
  GraphQLDateTime
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
    expect(
      GraphQLDateTime.serialize(new Date(Date.UTC(2016, 0, 1)))
    ).to.equal('2016-01-01T00:00:00.000Z');
    expect(
      GraphQLDateTime.serialize(new Date(Date.UTC(2016, 0, 1, 14, 48, 10, 3)))
    ).to.equal('2016-01-01T14:48:10.003Z');
    expect(() =>
      GraphQLDateTime.serialize('2016-01-01T14:48:10.003Z')
    ).to.throw(
      'DateTime cannot be serialized from a non Date ' +
      'type 2016-01-01T14:48:10.003Z'
    );
    expect(() =>
      GraphQLDateTime.serialize(75683393)
    ).to.throw(
      'DateTime cannot be serialized from a non Date type 75683393'
    );
    expect(() =>
      GraphQLDateTime.serialize(new Date('wrong date'))
    ).to.throw(
      'DateTime cannot represent an invalid date'
    );
  });

  it('parses input DateTime', () => {

    [
      [ '2016', new Date(Date.UTC(2016, 0)) ],
      [ '2016-11', new Date(Date.UTC(2016, 10)) ],
      [ '2016-11-05', new Date(Date.UTC(2016, 10, 5)) ],
      [ '20161105', new Date(Date.UTC(2016, 10, 5)) ],
      [ '2016-W44', new Date(Date.UTC(2016, 9, 31)) ],
      [ '2016W44', new Date(Date.UTC(2016, 9, 31)) ],
      [ '2016-W44-6', new Date(Date.UTC(2016, 10, 5)) ],
      [ '2016W446', new Date(Date.UTC(2016, 10, 5)) ],
      [ '2016-310', new Date(Date.UTC(2016, 10, 5)) ],
      [ '2016310', new Date(Date.UTC(2016, 10, 5)) ],
      [ '2016-01-01T10Z', new Date(Date.UTC(2016, 0, 1, 10)) ],
      [ '2016-01-01T10:10Z', new Date(Date.UTC(2016, 0, 1, 10, 10)) ],
      [ '2016-01-01T1010Z', new Date(Date.UTC(2016, 0, 1, 10, 10)) ],
      [ '2016-01-01T10:10:10Z', new Date(Date.UTC(2016, 0, 1, 10, 10, 10)) ],
      [ '2016-01-01T101010Z',
        new Date(Date.UTC(2016, 0, 1, 10, 10, 10)) ],
      [ '2016-01-01T10:10:10.321Z',
        new Date(Date.UTC(2016, 0, 1, 10, 10, 10, 321)) ],
      [ '2016-01-01T101010.321Z',
        new Date(Date.UTC(2016, 0, 1, 10, 10, 10, 321)) ]
    ].forEach(([ value, expected ]) => {
      expect(
        GraphQLDateTime.parseValue(value).getTime()
      ).to.equal(expected.getTime());
    });

    expect(() =>
      GraphQLDateTime.parseValue(75683393)
    ).to.throw(
      'DateTime cannot represent non string type 75683393'
    );

    [
      '01-01-2016',
      '201611',
      '2016-W44-8',
      '2015-02-29',
      '2016-01-01T101010.321'
    ].forEach(dateString => {
      expect(() =>
        GraphQLDateTime.parseValue(dateString)
      ).to.throw(
        'DateTime cannot represent an invalid ISO 8601 date ' + dateString
      );
    });
  });

  it('parses literal DateTime', () => {

    expect(
      GraphQLDateTime.parseLiteral({
        kind: Kind.STRING, value: '2016-01-01T101010.321Z'
      }).getTime()
    ).to.equal(
      new Date(Date.UTC(2016, 0, 1, 10, 10, 10, 321)).getTime()
    );
    expect(
      GraphQLDateTime.parseLiteral({
        kind: Kind.FLOAT, value: 5
      })
    ).to.equal(null);
    expect(
      GraphQLDateTime.parseLiteral({
        kind: Kind.STRING, value: '2015-02-29'
      })
    ).to.equal(null);
  });
});
