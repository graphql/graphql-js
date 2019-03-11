/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
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
      'Int cannot represent non-integer value: "-1.1"',
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
      'Int cannot represent non-integer value: "one"',
    );
    // Doesn't represent number
    expect(() => GraphQLInt.serialize('')).to.throw(
      'Int cannot represent non-integer value: ""',
    );
    expect(() => GraphQLInt.serialize(NaN)).to.throw(
      'Int cannot represent non-integer value: NaN',
    );
    expect(() => GraphQLInt.serialize(Infinity)).to.throw(
      'Int cannot represent non-integer value: Infinity',
    );
    expect(() => GraphQLInt.serialize([5])).to.throw(
      'Int cannot represent non-integer value: [5]',
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
    expect(() => GraphQLFloat.serialize(Infinity)).to.throw(
      'Float cannot represent non numeric value: Infinity',
    );
    expect(() => GraphQLFloat.serialize('one')).to.throw(
      'Float cannot represent non numeric value: "one"',
    );
    expect(() => GraphQLFloat.serialize('')).to.throw(
      'Float cannot represent non numeric value: ""',
    );
    expect(() => GraphQLFloat.serialize([5])).to.throw(
      'Float cannot represent non numeric value: [5]',
    );
  });

  it(`serializes output as String`, () => {
    expect(GraphQLString.serialize('string')).to.equal('string');
    expect(GraphQLString.serialize(1)).to.equal('1');
    expect(GraphQLString.serialize(-1.1)).to.equal('-1.1');
    expect(GraphQLString.serialize(true)).to.equal('true');
    expect(GraphQLString.serialize(false)).to.equal('false');

    const stringableObjValue = {
      valueOf() {
        return 'valueOf string';
      },
      toJSON() {
        return 'toJSON string';
      },
    };
    expect(GraphQLString.serialize(stringableObjValue)).to.equal(
      'valueOf string',
    );

    delete stringableObjValue.valueOf;
    expect(GraphQLString.serialize(stringableObjValue)).to.equal(
      'toJSON string',
    );

    expect(() => GraphQLString.serialize(NaN)).to.throw(
      'String cannot represent value: NaN',
    );

    expect(() => GraphQLString.serialize([1])).to.throw(
      'String cannot represent value: [1]',
    );

    const badObjValue = {};
    expect(() => GraphQLString.serialize(badObjValue)).to.throw(
      'String cannot represent value: {}',
    );
  });

  it('serializes output as Boolean', () => {
    expect(GraphQLBoolean.serialize(1)).to.equal(true);
    expect(GraphQLBoolean.serialize(0)).to.equal(false);
    expect(GraphQLBoolean.serialize(true)).to.equal(true);
    expect(GraphQLBoolean.serialize(false)).to.equal(false);

    expect(() => GraphQLBoolean.serialize(NaN)).to.throw(
      'Boolean cannot represent a non boolean value: NaN',
    );
    expect(() => GraphQLBoolean.serialize('')).to.throw(
      'Boolean cannot represent a non boolean value: ""',
    );
    expect(() => GraphQLBoolean.serialize('true')).to.throw(
      'Boolean cannot represent a non boolean value: "true"',
    );
    expect(() => GraphQLBoolean.serialize([false])).to.throw(
      'Boolean cannot represent a non boolean value: [false]',
    );
    expect(() => GraphQLBoolean.serialize({})).to.throw(
      'Boolean cannot represent a non boolean value: {}',
    );
  });

  it('serializes output as ID', () => {
    expect(GraphQLID.serialize('string')).to.equal('string');
    expect(GraphQLID.serialize('false')).to.equal('false');
    expect(GraphQLID.serialize('')).to.equal('');
    expect(GraphQLID.serialize(123)).to.equal('123');
    expect(GraphQLID.serialize(0)).to.equal('0');
    expect(GraphQLID.serialize(-1)).to.equal('-1');

    const serializableObjValue = {
      _id: 123,
      valueOf() {
        return this._id;
      },
      toJSON() {
        return `ID:${this._id}`;
      },
    };
    expect(GraphQLID.serialize(serializableObjValue)).to.equal('123');

    delete serializableObjValue.valueOf;
    expect(GraphQLID.serialize(serializableObjValue)).to.equal('ID:123');

    const badObjValue = {
      _id: false,
      valueOf() {
        return this._id;
      },
    };
    expect(() => GraphQLID.serialize(badObjValue)).to.throw(
      'ID cannot represent value: { _id: false, valueOf: [function valueOf] }',
    );

    expect(() => GraphQLID.serialize(true)).to.throw(
      'ID cannot represent value: true',
    );

    expect(() => GraphQLID.serialize(3.14)).to.throw(
      'ID cannot represent value: 3.14',
    );

    expect(() => GraphQLID.serialize({})).to.throw(
      'ID cannot represent value: {}',
    );

    expect(() => GraphQLID.serialize(['abc'])).to.throw(
      'ID cannot represent value: ["abc"]',
    );
  });
});
