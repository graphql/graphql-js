/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { coerceValue } from '../coerceValue';
import { GraphQLInt, GraphQLFloat, GraphQLString } from '../../type';

function expectNoErrors(result) {
  expect(result.errors).to.equal(undefined);
}

function expectError(result, expected) {
  const messages = result.errors && result.errors.map(error => error.message);
  expect(messages).to.deep.equal([expected]);
}

describe('coerceValue', () => {
  it('coercing an array to GraphQLString produces an error', () => {
    const result = coerceValue([1, 2, 3], GraphQLString);
    expectError(
      result,
      'Expected type String; String cannot represent an array value: [1,2,3]',
    );
    expect(result.errors[0].originalError.message).to.equal(
      'String cannot represent an array value: [1,2,3]',
    );
  });

  describe('for GraphQLInt', () => {
    it('returns no error for int input', () => {
      const result = coerceValue('1', GraphQLInt);
      expectNoErrors(result);
    });

    it('returns no error for negative int input', () => {
      const result = coerceValue('-1', GraphQLInt);
      expectNoErrors(result);
    });

    it('returns no error for exponent input', () => {
      const result = coerceValue('1e3', GraphQLInt);
      expectNoErrors(result);
    });

    it('returns a single error for empty value', () => {
      const result = coerceValue(null, GraphQLInt);
      expectNoErrors(result);
    });

    it('returns a single error for empty value', () => {
      const result = coerceValue('', GraphQLInt);
      expectError(
        result,
        'Expected type Int; Int cannot represent non 32-bit signed integer value: (empty string)',
      );
    });

    it('returns error for float input as int', () => {
      const result = coerceValue('1.5', GraphQLInt);
      expectError(
        result,
        'Expected type Int; Int cannot represent non-integer value: 1.5',
      );
    });

    it('returns a single error for char input', () => {
      const result = coerceValue('a', GraphQLInt);
      expectError(
        result,
        'Expected type Int; Int cannot represent non 32-bit signed integer value: a',
      );
    });

    it('returns a single error for char input', () => {
      const result = coerceValue('meow', GraphQLInt);
      expectError(
        result,
        'Expected type Int; Int cannot represent non 32-bit signed integer value: meow',
      );
    });
  });

  describe('for GraphQLFloat', () => {
    it('returns no error for int input', () => {
      const result = coerceValue('1', GraphQLFloat);
      expectNoErrors(result);
    });

    it('returns no error for exponent input', () => {
      const result = coerceValue('1e3', GraphQLFloat);
      expectNoErrors(result);
    });

    it('returns no error for float input', () => {
      const result = coerceValue('1.5', GraphQLFloat);
      expectNoErrors(result);
    });

    it('returns a single error for empty value', () => {
      const result = coerceValue(null, GraphQLFloat);
      expectNoErrors(result);
    });

    it('returns a single error for empty value', () => {
      const result = coerceValue('', GraphQLFloat);
      expectError(
        result,
        'Expected type Float; Float cannot represent non numeric value: (empty string)',
      );
    });

    it('returns a single error for char input', () => {
      const result = coerceValue('a', GraphQLFloat);
      expectError(
        result,
        'Expected type Float; Float cannot represent non numeric value: a',
      );
    });

    it('returns a single error for char input', () => {
      const result = coerceValue('meow', GraphQLFloat);
      expectError(
        result,
        'Expected type Float; Float cannot represent non numeric value: meow',
      );
    });
  });
});
