// @flow strict

import { describe, it } from 'mocha';
import { expect } from 'chai';

import invariant from '../../jsutils/invariant';
import {
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLInputObjectType,
} from '../../type';
import { coerceValue } from '../coerceValue';

function expectValue(result) {
  expect(result.errors).to.equal(undefined);
  return expect(result.value);
}

function expectErrors(result) {
  expect(result.value).to.equal(undefined);
  const messages = result.errors && result.errors.map(error => error.message);
  return expect(messages);
}

describe('coerceValue', () => {
  describe('for GraphQLNonNull', () => {
    const TestNonNull = new GraphQLNonNull(GraphQLInt);

    it('returns no error for non-null value', () => {
      const result = coerceValue(1, TestNonNull);
      expectValue(result).to.equal(1);
    });

    it('returns an error for undefined value', () => {
      const result = coerceValue(undefined, TestNonNull);
      expectErrors(result).to.deep.equal([
        'Expected non-nullable type Int! not to be null.',
      ]);
    });

    it('returns an error for null value', () => {
      const result = coerceValue(null, TestNonNull);
      expectErrors(result).to.deep.equal([
        'Expected non-nullable type Int! not to be null.',
      ]);
    });
  });

  describe('for GraphQLScalar', () => {
    const TestScalar = new GraphQLScalarType({
      name: 'TestScalar',
      parseValue(input) {
        invariant(typeof input === 'object' && input !== null);
        if (input.error != null) {
          throw input.error;
        }
        return input.value;
      },
    });

    it('returns no error for valid input', () => {
      const result = coerceValue({ value: 1 }, TestScalar);
      expectValue(result).to.equal(1);
    });

    it('returns no error for null result', () => {
      const result = coerceValue({ value: null }, TestScalar);
      expectValue(result).to.equal(null);
    });

    it('returns no error for NaN result', () => {
      const result = coerceValue({ value: NaN }, TestScalar);
      expectValue(result).to.satisfy(Number.isNaN);
    });

    it('returns an error for undefined result', () => {
      const result = coerceValue({ value: undefined }, TestScalar);
      expectErrors(result).to.deep.equal(['Expected type TestScalar.']);
    });

    it('returns an error for undefined result', () => {
      const error = new Error('Some error message');
      const result = coerceValue({ error }, TestScalar);
      expectErrors(result).to.deep.equal([
        'Expected type TestScalar. Some error message',
      ]);
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
      expectValue(fooResult).to.equal('InternalFoo');

      const barResult = coerceValue('BAR', TestEnum);
      expectValue(barResult).to.equal(123456789);
    });

    it('returns an error for misspelled enum value', () => {
      const result = coerceValue('foo', TestEnum);
      expectErrors(result).to.deep.equal([
        'Expected type TestEnum. Did you mean FOO?',
      ]);
    });

    it('returns an error for incorrect value type', () => {
      const result1 = coerceValue(123, TestEnum);
      expectErrors(result1).to.deep.equal(['Expected type TestEnum.']);

      const result2 = coerceValue({ field: 'value' }, TestEnum);
      expectErrors(result2).to.deep.equal(['Expected type TestEnum.']);
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
      expectValue(result).to.deep.equal({ foo: 123 });
    });

    it('returns an error for a non-object type', () => {
      const result = coerceValue(123, TestInputObject);
      expectErrors(result).to.deep.equal([
        'Expected type TestInputObject to be an object.',
      ]);
    });

    it('returns an error for an invalid field', () => {
      const result = coerceValue({ foo: NaN }, TestInputObject);
      expectErrors(result).to.deep.equal([
        'Expected type Int at value.foo. Int cannot represent non-integer value: NaN',
      ]);
    });

    it('returns multiple errors for multiple invalid fields', () => {
      const result = coerceValue({ foo: 'abc', bar: 'def' }, TestInputObject);
      expectErrors(result).to.deep.equal([
        'Expected type Int at value.foo. Int cannot represent non-integer value: "abc"',
        'Expected type Int at value.bar. Int cannot represent non-integer value: "def"',
      ]);
    });

    it('returns error for a missing required field', () => {
      const result = coerceValue({ bar: 123 }, TestInputObject);
      expectErrors(result).to.deep.equal([
        'Field value.foo of required type Int! was not provided.',
      ]);
    });

    it('returns error for an unknown field', () => {
      const result = coerceValue(
        { foo: 123, unknownField: 123 },
        TestInputObject,
      );
      expectErrors(result).to.deep.equal([
        'Field "unknownField" is not defined by type TestInputObject.',
      ]);
    });

    it('returns error for a misspelled field', () => {
      const result = coerceValue({ foo: 123, bart: 123 }, TestInputObject);
      expectErrors(result).to.deep.equal([
        'Field "bart" is not defined by type TestInputObject. Did you mean bar?',
      ]);
    });
  });

  describe('for GraphQLInputObject with default value', () => {
    const TestInputObject = defaultValue =>
      new GraphQLInputObjectType({
        name: 'TestInputObject',
        fields: {
          foo: {
            type: new GraphQLScalarType({ name: 'TestScalar' }),
            defaultValue,
          },
        },
      });

    it('returns no errors for valid input value', () => {
      const result = coerceValue({ foo: 5 }, TestInputObject(7));
      expectValue(result).to.deep.equal({ foo: 5 });
    });

    it('returns object with default value', () => {
      const result = coerceValue({}, TestInputObject(7));
      expectValue(result).to.deep.equal({ foo: 7 });
    });

    it('returns null as value', () => {
      const result = coerceValue({}, TestInputObject(null));
      expectValue(result).to.deep.equal({ foo: null });
    });

    it('returns NaN as value', () => {
      const result = coerceValue({}, TestInputObject(NaN));
      expectValue(result)
        .to.have.property('foo')
        .that.satisfy(Number.isNaN);
    });
  });

  describe('for GraphQLList', () => {
    const TestList = GraphQLList(GraphQLInt);

    it('returns no error for a valid input', () => {
      const result = coerceValue([1, 2, 3], TestList);
      expectValue(result).to.deep.equal([1, 2, 3]);
    });

    it('returns an error for an invalid input', () => {
      const result = coerceValue([1, 'b', true, 4], TestList);
      expectErrors(result).to.deep.equal([
        'Expected type Int at value[1]. Int cannot represent non-integer value: "b"',
        'Expected type Int at value[2]. Int cannot represent non-integer value: true',
      ]);
    });

    it('returns a list for a non-list value', () => {
      const result = coerceValue(42, TestList);
      expectValue(result).to.deep.equal([42]);
    });

    it('returns an error for a non-list invalid value', () => {
      const result = coerceValue('INVALID', TestList);
      expectErrors(result).to.deep.equal([
        'Expected type Int. Int cannot represent non-integer value: "INVALID"',
      ]);
    });

    it('returns null for a null value', () => {
      const result = coerceValue(null, TestList);
      expectValue(result).to.deep.equal(null);
    });
  });

  describe('for nested GraphQLList', () => {
    const TestNestedList = GraphQLList(GraphQLList(GraphQLInt));

    it('returns no error for a valid input', () => {
      const result = coerceValue([[1], [2, 3]], TestNestedList);
      expectValue(result).to.deep.equal([[1], [2, 3]]);
    });

    it('returns a list for a non-list value', () => {
      const result = coerceValue(42, TestNestedList);
      expectValue(result).to.deep.equal([[42]]);
    });

    it('returns null for a null value', () => {
      const result = coerceValue(null, TestNestedList);
      expectValue(result).to.deep.equal(null);
    });

    it('returns nested lists for nested non-list values', () => {
      const result = coerceValue([1, 2, 3], TestNestedList);
      expectValue(result).to.deep.equal([[1], [2], [3]]);
    });

    it('returns nested null for nested null values', () => {
      const result = coerceValue([42, [null], null], TestNestedList);
      expectValue(result).to.deep.equal([[42], [null], null]);
    });
  });
});
