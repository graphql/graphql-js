/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { isValidJSValue } from '../isValidJSValue';
import {
  GraphQLInt,
  GraphQLFloat,
} from '../../type';

function expectNoErrors(result) {
  expect(result).to.be.an.instanceof(Array);
  expect(result.length).to.equal(0);
}

function expectErrorResult(result, size) {
  expect(result).to.be.an.instanceof(Array);
  expect(result.length).to.equal(size);
}

describe('isValidJSValue for GraphQLInt', () => {
  it('returns no error for int input', () => {
    const result = isValidJSValue('1', GraphQLInt);
    expectNoErrors(result);
  });

  it('returns no error for negative int input', () => {
    const result = isValidJSValue('-1', GraphQLInt);
    expectNoErrors(result);
  });

  it('returns no error for exponent input', () => {
    const result = isValidJSValue('1e3', GraphQLInt);
    expectNoErrors(result);
  });

  it('returns a single error for empty value', () => {
    const result = isValidJSValue(null, GraphQLInt);
    expectNoErrors(result);
  });

  it('returns a single error for empty value', () => {
    const result = isValidJSValue('', GraphQLInt);
    expectErrorResult(result, 1);
  });

  it('returns error for float input as int', () => {
    const result = isValidJSValue('1.5', GraphQLInt);
    expectErrorResult(result, 1);
  });

  it('returns a single error for char input', () => {
    const result = isValidJSValue('a', GraphQLInt);
    expectErrorResult(result, 1);
  });

  it('returns a single error for char input', () => {
    const result = isValidJSValue('meow', GraphQLInt);
    expectErrorResult(result, 1);
  });
});

describe('isValidJSValue for GraphQLFloat', () => {
  it('returns no error for int input', () => {
    const result = isValidJSValue('1', GraphQLFloat);
    expectNoErrors(result);
  });

  it('returns no error for exponent input', () => {
    const result = isValidJSValue('1e3', GraphQLFloat);
    expectNoErrors(result);
  });

  it('returns no error for float input', () => {
    const result = isValidJSValue('1.5', GraphQLFloat);
    expectNoErrors(result);
  });

  it('returns a single error for empty value', () => {
    const result = isValidJSValue(null, GraphQLFloat);
    expectNoErrors(result);
  });

  it('returns a single error for empty value', () => {
    const result = isValidJSValue('', GraphQLFloat);
    expectErrorResult(result, 1);
  });

  it('returns a single error for char input', () => {
    const result = isValidJSValue('a', GraphQLFloat);
    expectErrorResult(result, 1);
  });

  it('returns a single error for char input', () => {
    const result = isValidJSValue('meow', GraphQLFloat);
    expectErrorResult(result, 1);
  });
});
