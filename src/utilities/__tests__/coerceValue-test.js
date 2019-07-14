// @flow strict

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { coerceValue } from '../coerceValue';
import {
  GraphQLID,
  GraphQLInt,
  GraphQLFloat,
  GraphQLList,
  GraphQLString,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLNonNull,
} from '../../type';

function expectValue(result) {
  expect(result.errors).to.equal(undefined);
  expect(result.errorLimitReached).to.equal(undefined);
  return expect(result.value);
}

function expectErrors(result) {
  expect(result.value).to.equal(undefined);
  expect(result.errorLimitReached).to.not.equal(undefined);
  const messages = result.errors && result.errors.map(error => error.message);
  return expect(messages);
}

describe('coerceValue', () => {
  describe('for GraphQLString', () => {
    it('returns error for array input as string', () => {
      const result = coerceValue([1, 2, 3], GraphQLString);
      expectErrors(result).to.deep.equal([
        'Expected type String. String cannot represent a non string value: [1, 2, 3]',
      ]);
    });
  });

  describe('for GraphQLID', () => {
    it('returns error for array input as ID', () => {
      const result = coerceValue([1, 2, 3], GraphQLID);
      expectErrors(result).to.deep.equal([
        'Expected type ID. ID cannot represent value: [1, 2, 3]',
      ]);
    });
  });

  describe('for GraphQLInt', () => {
    it('returns value for integer', () => {
      const result = coerceValue(1, GraphQLInt);
      expectValue(result).to.equal(1);
    });

    it('returns error for numeric looking string', () => {
      const result = coerceValue('1', GraphQLInt);
      expectErrors(result).to.deep.equal([
        'Expected type Int. Int cannot represent non-integer value: "1"',
      ]);
    });

    it('returns value for negative int input', () => {
      const result = coerceValue(-1, GraphQLInt);
      expectValue(result).to.equal(-1);
    });

    it('returns value for exponent input', () => {
      const result = coerceValue(1e3, GraphQLInt);
      expectValue(result).to.equal(1000);
    });

    it('returns null for null value', () => {
      const result = coerceValue(null, GraphQLInt);
      expectValue(result).to.equal(null);
    });

    it('returns a single error for empty string as value', () => {
      const result = coerceValue('', GraphQLInt);
      expectErrors(result).to.deep.equal([
        'Expected type Int. Int cannot represent non-integer value: ""',
      ]);
    });

    it('returns a single error for 2^32 input as int', () => {
      const result = coerceValue(Math.pow(2, 32), GraphQLInt);
      expectErrors(result).to.deep.equal([
        'Expected type Int. Int cannot represent non 32-bit signed integer value: 4294967296',
      ]);
    });

    it('returns a single error for float input as int', () => {
      const result = coerceValue(1.5, GraphQLInt);
      expectErrors(result).to.deep.equal([
        'Expected type Int. Int cannot represent non-integer value: 1.5',
      ]);
    });

    it('returns a single error for NaN input as int', () => {
      const result = coerceValue(NaN, GraphQLInt);
      expectErrors(result).to.deep.equal([
        'Expected type Int. Int cannot represent non-integer value: NaN',
      ]);
    });

    it('returns a single error for Infinity input as int', () => {
      const result = coerceValue(Infinity, GraphQLInt);
      expectErrors(result).to.deep.equal([
        'Expected type Int. Int cannot represent non-integer value: Infinity',
      ]);
    });

    it('returns a single error for char input', () => {
      const result = coerceValue('a', GraphQLInt);
      expectErrors(result).to.deep.equal([
        'Expected type Int. Int cannot represent non-integer value: "a"',
      ]);
    });

    it('returns a single error for string input', () => {
      const result = coerceValue('meow', GraphQLInt);
      expectErrors(result).to.deep.equal([
        'Expected type Int. Int cannot represent non-integer value: "meow"',
      ]);
    });
  });

  describe('for GraphQLFloat', () => {
    it('returns value for integer', () => {
      const result = coerceValue(1, GraphQLFloat);
      expectValue(result).to.equal(1);
    });

    it('returns value for decimal', () => {
      const result = coerceValue(1.1, GraphQLFloat);
      expectValue(result).to.equal(1.1);
    });

    it('returns value for exponent input', () => {
      const result = coerceValue(1e3, GraphQLFloat);
      expectValue(result).to.equal(1000);
    });

    it('returns error for numeric looking string', () => {
      const result = coerceValue('1', GraphQLFloat);
      expectErrors(result).to.deep.equal([
        'Expected type Float. Float cannot represent non numeric value: "1"',
      ]);
    });

    it('returns null for null value', () => {
      const result = coerceValue(null, GraphQLFloat);
      expectValue(result).to.equal(null);
    });

    it('returns a single error for empty string input', () => {
      const result = coerceValue('', GraphQLFloat);
      expectErrors(result).to.deep.equal([
        'Expected type Float. Float cannot represent non numeric value: ""',
      ]);
    });

    it('returns a single error for NaN input', () => {
      const result = coerceValue(NaN, GraphQLFloat);
      expectErrors(result).to.deep.equal([
        'Expected type Float. Float cannot represent non numeric value: NaN',
      ]);
    });

    it('returns a single error for Infinity input', () => {
      const result = coerceValue(Infinity, GraphQLFloat);
      expectErrors(result).to.deep.equal([
        'Expected type Float. Float cannot represent non numeric value: Infinity',
      ]);
    });

    it('returns a single error for char input', () => {
      const result = coerceValue('a', GraphQLFloat);
      expectErrors(result).to.deep.equal([
        'Expected type Float. Float cannot represent non numeric value: "a"',
      ]);
    });

    it('returns a single error for char input', () => {
      const result = coerceValue('meow', GraphQLFloat);
      expectErrors(result).to.deep.equal([
        'Expected type Float. Float cannot represent non numeric value: "meow"',
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

    it('results error for misspelled enum value', () => {
      const result = coerceValue('foo', TestEnum);
      expectErrors(result).to.deep.equal([
        'Expected type TestEnum. Did you mean FOO?',
      ]);
    });

    it('results error for incorrect value type', () => {
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
      const result = coerceValue({ foo: 'abc' }, TestInputObject);
      expectErrors(result).to.deep.equal([
        'Expected type Int at value.foo. Int cannot represent non-integer value: "abc"',
      ]);
    });

    it('returns multiple errors for multiple invalid fields', () => {
      const result = coerceValue({ foo: 'abc', bar: 'def' }, TestInputObject);
      expectErrors(result).to.deep.equal([
        'Expected type Int at value.foo. Int cannot represent non-integer value: "abc"',
        'Expected type Int at value.bar. Int cannot represent non-integer value: "def"',
      ]);
    });

    it('limits errors for too many invalid fields', () => {
      const TestInputBigObjectConfig = {
        name: 'TestInputBigObject',
        fields: {},
      };
      const valueObject = {};
      const errors = [];
      for (let index = 0; index < 100; ++index) {
        TestInputBigObjectConfig.fields[`field${index}`] = {
          type: GraphQLNonNull(GraphQLInt),
        };
        valueObject[`field${index}`] = 'abc';
        if (index < 50) {
          errors.push(
            `Expected type Int at value.field${index}. Int cannot represent non-integer value: "abc"`,
          );
        }
      }
      const TestInputBigObject = new GraphQLInputObjectType(
        TestInputBigObjectConfig,
      );
      const result = coerceValue(valueObject, TestInputBigObject);
      expectErrors(result).to.deep.equal(errors);
      expect(result.errorLimitReached).to.equal(true);
    });

    it('returns error for a missing required field', () => {
      const result = coerceValue({ bar: 123 }, TestInputObject);
      expectErrors(result).to.deep.equal([
        'Field value.foo of required type Int! was not provided.',
      ]);
    });

    it('limits errors for too many missing required fields', () => {
      const TestInputBigObjectConfig = {
        name: 'TestInputBigObject',
        fields: {},
      };
      const errors = [];
      for (let index = 0; index < 100; ++index) {
        TestInputBigObjectConfig.fields[`field${index}`] = {
          type: GraphQLNonNull(GraphQLInt),
        };
        if (index < 50) {
          errors.push(
            `Field value.field${index} of required type Int! was not provided.`,
          );
        }
      }
      const TestInputBigObject = new GraphQLInputObjectType(
        TestInputBigObjectConfig,
      );
      const result = coerceValue({}, TestInputBigObject);
      expectErrors(result).to.deep.equal(errors);
      expect(result.errorLimitReached).to.equal(true);
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

    it('limits errors for too many unkown fields', () => {
      const valueObject = { foo: 123 };
      const errors = [];
      for (let index = 0; index < 100; ++index) {
        valueObject[`field${index}`] = 'string';
        if (index < 50) {
          errors.push(
            `Field "field${index}" is not defined by type TestInputObject.`,
          );
        }
      }
      const result = coerceValue(valueObject, TestInputObject);
      expectErrors(result).to.deep.equal(errors);
      expect(result.errorLimitReached).to.equal(true);
    });

    it('returns error for a misspelled field', () => {
      const result = coerceValue({ foo: 123, bart: 123 }, TestInputObject);
      expectErrors(result).to.deep.equal([
        'Field "bart" is not defined by type TestInputObject. Did you mean bar?',
      ]);
    });
  });

  describe('for GraphQLList', () => {
    const TestList = GraphQLList(GraphQLInt);

    it('returns no error for a valid input', () => {
      const result = coerceValue([1, 2, 3], TestList);
      expectValue(result).to.deep.equal([1, 2, 3]);
    });

    it('returns an error for an invalid input', () => {
      const result = coerceValue([1, 'b', true], TestList);
      expectErrors(result).to.deep.equal([
        'Expected type Int at value[1]. Int cannot represent non-integer value: "b"',
        'Expected type Int at value[2]. Int cannot represent non-integer value: true',
      ]);
    });

    it('returns a list for a non-list value', () => {
      const result = coerceValue(42, TestList);
      expectValue(result).to.deep.equal([42]);
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

    it('returns an error array limited to 50 errors and limit reached flag is true', () => {
      const value = [];
      const errors = [];
      for (let index = 0; index < 100; ++index) {
        value.push(['string']);
        if (index < 50) {
          errors.push(
            `Expected type Int at value[${index}][0]. Int cannot represent non-integer value: "string"`,
          );
        }
      }
      const result = coerceValue(value, TestNestedList);
      expectErrors(result).to.deep.equal(errors);
      expect(result.errorLimitReached).to.equal(true);
    });
  });
});
