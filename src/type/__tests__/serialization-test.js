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
  GraphQLBoolean
} from '../';

import { describe, it } from 'mocha';
import { expect } from 'chai';


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
});
