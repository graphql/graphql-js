/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { coerceValue } from '../coerceValue';
import {
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLNonNull,
} from '../../type';

function expectNoErrors(result) {
  expect(result.errors).to.equal(undefined);
  expect(result.value).not.to.equal(undefined);
}

function expectError(result, expected) {
  const messages = result.errors && result.errors.map(error => error.message);
  expect(messages).to.deep.equal([expected]);
  expect(result.value).to.equal(undefined);
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

  describe('for GraphQLEnum', () => {
    const TestEnum = new GraphQLEnumType({
      name: 'TestEnum',
      values: {
        FOO: { value: 'InternalFoo' },
        BAR: { value: 123456789 },
      },
    });

    it('returns no error for a known enum name', () => {
      const fooResult = coerceValue('FOO', TestEnum);
      expectNoErrors(fooResult);
      expect(fooResult.value).to.equal('InternalFoo');

      const barResult = coerceValue('BAR', TestEnum);
      expectNoErrors(barResult);
      expect(barResult.value).to.equal(123456789);
    });

    it('results error for misspelled enum value', () => {
      const result = coerceValue('foo', TestEnum);
      expectError(result, 'Expected type TestEnum; did you mean FOO?');
    });

    it('results error for incorrect value type', () => {
      const result1 = coerceValue(123, TestEnum);
      expectError(result1, 'Expected type TestEnum.');

      const result2 = coerceValue({ field: 'value' }, TestEnum);
      expectError(result2, 'Expected type TestEnum.');
    });
  });

  describe('for GraphQLInputObject', () => {
    const TestInputObject = new GraphQLInputObjectType({
      name: 'TestInputObject',
      fields: {
        foo: { type: GraphQLNonNull(GraphQLInt) },
        bar: { type: GraphQLInt },
      },
    });

    it('returns no error for a valid input', () => {
      const result = coerceValue({ foo: 123 }, TestInputObject);
      expectNoErrors(result);
      expect(result.value).to.deep.equal({ foo: 123 });
    });

    it('returns no error for a non-object type', () => {
      const result = coerceValue(123, TestInputObject);
      expectError(result, 'Expected type TestInputObject to be an object.');
    });

    it('returns no error for an invalid field', () => {
      const result = coerceValue({ foo: 'abc' }, TestInputObject);
      expectError(
        result,
        'Expected type Int at value.foo; Int cannot represent non 32-bit signed integer value: abc',
      );
    });

    it('returns multiple errors for multiple invalid fields', () => {
      const result = coerceValue({ foo: 'abc', bar: 'def' }, TestInputObject);
      expect(
        result.errors && result.errors.map(error => error.message),
      ).to.deep.equal([
        'Expected type Int at value.foo; Int cannot represent non 32-bit signed integer value: abc',
        'Expected type Int at value.bar; Int cannot represent non 32-bit signed integer value: def',
      ]);
    });

    it('returns error for a missing required field', () => {
      const result = coerceValue({ bar: 123 }, TestInputObject);
      expectError(
        result,
        'Field value.foo of required type Int! was not provided.',
      );
    });

    it('returns error for an unknown field', () => {
      const result = coerceValue(
        { foo: 123, unknownField: 123 },
        TestInputObject,
      );
      expectError(
        result,
        'Field "unknownField" is not defined by type TestInputObject.',
      );
    });

    it('returns error for a misspelled field', () => {
      const result = coerceValue({ foo: 123, bart: 123 }, TestInputObject);
      expectError(
        result,
        'Field "bart" is not defined by type TestInputObject; did you mean bar?',
      );
    });
  });
});
