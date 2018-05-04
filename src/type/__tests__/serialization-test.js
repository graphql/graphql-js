/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  GraphQLInt,
  GraphQLID,
  GraphQLFloat,
  GraphQLString,
  GraphQLBoolean,
} from '../';

import { describe, it } from 'mocha';
import { expect } from 'chai';

describe('Type System: Scalar coercion', () => {
  it('serializes output as Int', () => {
    expect(GraphQLInt.serialize(1)).to.equal(1);
    expect(GraphQLInt.serialize('123')).to.equal(123);
    expect(GraphQLInt.serialize(0)).to.equal(0);
    expect(GraphQLInt.serialize(-1)).to.equal(-1);
    expect(GraphQLInt.serialize(1e5)).to.equal(100000);
    expect(GraphQLInt.serialize(false)).to.equal(0);
    expect(GraphQLInt.serialize(true)).to.equal(1);

    // The GraphQL specification does not allow serializing non-integer values
    // as Int to avoid accidental data loss.
    expect(() => GraphQLInt.serialize(0.1)).to.throw(
      'Int cannot represent non-integer value: 0.1',
    );
    expect(() => GraphQLInt.serialize(1.1)).to.throw(
      'Int cannot represent non-integer value: 1.1',
    );
    expect(() => GraphQLInt.serialize(-1.1)).to.throw(
      'Int cannot represent non-integer value: -1.1',
    );
    expect(() => GraphQLInt.serialize('-1.1')).to.throw(
      'Int cannot represent non-integer value: -1.1',
    );
    // Maybe a safe JavaScript int, but bigger than 2^32, so not
    // representable as a GraphQL Int
    expect(() => GraphQLInt.serialize(9876504321)).to.throw(
      'Int cannot represent non 32-bit signed integer value: 9876504321',
    );
    expect(() => GraphQLInt.serialize(-9876504321)).to.throw(
      'Int cannot represent non 32-bit signed integer value: -9876504321',
    );
    // Too big to represent as an Int in JavaScript or GraphQL
    expect(() => GraphQLInt.serialize(1e100)).to.throw(
      'Int cannot represent non 32-bit signed integer value: 1e+100',
    );
    expect(() => GraphQLInt.serialize(-1e100)).to.throw(
      'Int cannot represent non 32-bit signed integer value: -1e+100',
    );
    expect(() => GraphQLInt.serialize('one')).to.throw(
      'Int cannot represent non 32-bit signed integer value: one',
    );
    // Doesn't represent number
    expect(() => GraphQLInt.serialize('')).to.throw(
      'Int cannot represent non 32-bit signed integer value: (empty string)',
    );
    expect(() => GraphQLInt.serialize(NaN)).to.throw(
      'Int cannot represent non 32-bit signed integer value: NaN',
    );
    expect(() => GraphQLInt.serialize([5])).to.throw(
      'Int cannot represent an array value: [5]',
    );
  });

  it('serializes output as Float', () => {
    expect(GraphQLFloat.serialize(1)).to.equal(1.0);
    expect(GraphQLFloat.serialize(0)).to.equal(0.0);
    expect(GraphQLFloat.serialize('123.5')).to.equal(123.5);
    expect(GraphQLFloat.serialize(-1)).to.equal(-1.0);
    expect(GraphQLFloat.serialize(0.1)).to.equal(0.1);
    expect(GraphQLFloat.serialize(1.1)).to.equal(1.1);
    expect(GraphQLFloat.serialize(-1.1)).to.equal(-1.1);
    expect(GraphQLFloat.serialize('-1.1')).to.equal(-1.1);
    expect(GraphQLFloat.serialize(false)).to.equal(0.0);
    expect(GraphQLFloat.serialize(true)).to.equal(1.0);

    expect(() => GraphQLFloat.serialize(NaN)).to.throw(
      'Float cannot represent non numeric value: NaN',
    );
    expect(() => GraphQLFloat.serialize('one')).to.throw(
      'Float cannot represent non numeric value: one',
    );
    expect(() => GraphQLFloat.serialize('')).to.throw(
      'Float cannot represent non numeric value: (empty string)',
    );
    expect(() => GraphQLFloat.serialize([5])).to.throw(
      'Float cannot represent an array value: [5]',
    );
  });

  for (const scalar of [GraphQLString, GraphQLID]) {
    it(`serializes output as ${scalar}`, () => {
      expect(scalar.serialize('string')).to.equal('string');
      expect(scalar.serialize(1)).to.equal('1');
      expect(scalar.serialize(-1.1)).to.equal('-1.1');
      expect(scalar.serialize(true)).to.equal('true');
      expect(scalar.serialize(false)).to.equal('false');

      expect(() => scalar.serialize([1])).to.throw(
        'String cannot represent an array value: [1]',
      );
    });
  }

  it('serializes output as Boolean', () => {
    expect(GraphQLBoolean.serialize('string')).to.equal(true);
    expect(GraphQLBoolean.serialize('false')).to.equal(true);
    expect(GraphQLBoolean.serialize('')).to.equal(false);
    expect(GraphQLBoolean.serialize(1)).to.equal(true);
    expect(GraphQLBoolean.serialize(0)).to.equal(false);
    expect(GraphQLBoolean.serialize(true)).to.equal(true);
    expect(GraphQLBoolean.serialize(false)).to.equal(false);

    expect(() => GraphQLBoolean.serialize([false])).to.throw(
      'Boolean cannot represent an array value: [false]',
    );
  });
});
