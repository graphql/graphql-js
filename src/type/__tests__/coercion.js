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
  it('coerces output int', () => {
    expect(
      GraphQLInt.coerce(1)
    ).to.equal(1);
    expect(
      GraphQLInt.coerce(0)
    ).to.equal(0);
    expect(
      GraphQLInt.coerce(-1)
    ).to.equal(-1);
    expect(
      GraphQLInt.coerce(0.1)
    ).to.equal(0);
    expect(
      GraphQLInt.coerce(1.1)
    ).to.equal(1);
    expect(
      GraphQLInt.coerce(-1.1)
    ).to.equal(-1);
    expect(
      GraphQLInt.coerce(1e5)
    ).to.equal(100000);
    // Bigger than 2^32, but still representable as an Int
    expect(
      GraphQLInt.coerce(9876504321)
    ).to.equal(9876504321);
    expect(
      GraphQLInt.coerce(-9876504321)
    ).to.equal(-9876504321);
    // Too big to represent as an Int
    expect(
      GraphQLInt.coerce(1e100)
    ).to.equal(null);
    expect(
      GraphQLInt.coerce(-1e100)
    ).to.equal(null);
    expect(
      GraphQLInt.coerce('-1.1')
    ).to.equal(-1);
    expect(
      GraphQLInt.coerce('one')
    ).to.equal(null);
    expect(
      GraphQLInt.coerce(false)
    ).to.equal(0);
    expect(
      GraphQLInt.coerce(true)
    ).to.equal(1);
  });

  it('coerces output float', () => {
    expect(
      GraphQLFloat.coerce(1)
    ).to.equal(1.0);
    expect(
      GraphQLFloat.coerce(0)
    ).to.equal(0.0);
    expect(
      GraphQLFloat.coerce(-1)
    ).to.equal(-1.0);
    expect(
      GraphQLFloat.coerce(0.1)
    ).to.equal(0.1);
    expect(
      GraphQLFloat.coerce(1.1)
    ).to.equal(1.1);
    expect(
      GraphQLFloat.coerce(-1.1)
    ).to.equal(-1.1);
    expect(
      GraphQLFloat.coerce('-1.1')
    ).to.equal(-1.1);
    expect(
      GraphQLFloat.coerce('one')
    ).to.equal(null);
    expect(
      GraphQLFloat.coerce(false)
    ).to.equal(0.0);
    expect(
      GraphQLFloat.coerce(true)
    ).to.equal(1.0);
  });

  it('coerces output strings', () => {
    expect(
      GraphQLString.coerce('string')
    ).to.equal('string');
    expect(
      GraphQLString.coerce(1)
    ).to.equal('1');
    expect(
      GraphQLString.coerce(-1.1)
    ).to.equal('-1.1');
    expect(
      GraphQLString.coerce(true)
    ).to.equal('true');
    expect(
      GraphQLString.coerce(false)
    ).to.equal('false');
  });

  it('coerces output boolean', () => {
    expect(
      GraphQLBoolean.coerce('string')
    ).to.equal(true);
    expect(
      GraphQLBoolean.coerce('')
    ).to.equal(false);
    expect(
      GraphQLBoolean.coerce(1)
    ).to.equal(true);
    expect(
      GraphQLBoolean.coerce(0)
    ).to.equal(false);
    expect(
      GraphQLBoolean.coerce(true)
    ).to.equal(true);
    expect(
      GraphQLBoolean.coerce(false)
    ).to.equal(false);
  });
});
