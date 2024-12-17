import { expect } from 'chai';
import { describe, it } from 'mocha';

import { invariant } from '../../jsutils/invariant.js';
import type { ReadOnlyObjMap } from '../../jsutils/ObjMap.js';

import { Parser, parseValue } from '../../language/parser.js';
import { TokenKind } from '../../language/tokenKind.js';

import type { GraphQLInputType } from '../../type/definition.js';
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
} from '../../type/definition.js';
import { GraphQLInt } from '../../type/scalars.js';
import { GraphQLSchema } from '../../type/schema.js';

import type { VariableValues } from '../../execution/values.js';
import { getVariableValues } from '../../execution/values.js';

import {
  validateInputLiteral,
  validateInputValue,
} from '../validateInputValue.js';

describe('validateInputValue', () => {
  function test(
    inputValue: unknown,
    type: GraphQLInputType,
    expected: unknown,
    hideSuggestions = false,
  ) {
    const errors: any = [];
    validateInputValue(
      inputValue,
      type,
      (error, path) => {
        errors.push({ error: error.message, path });
      },
      hideSuggestions,
    );
    expect(errors).to.deep.equal(expected);
  }

  describe('for GraphQLNonNull', () => {
    const TestNonNull = new GraphQLNonNull(GraphQLInt);

    it('returns no error for non-null value', () => {
      test(1, TestNonNull, []);
    });

    it('returns an error for undefined value', () => {
      test(undefined, TestNonNull, [
        {
          error: 'Expected a value of non-null type "Int!" to be provided.',
          path: [],
        },
      ]);
    });

    it('returns an error for null value', () => {
      test(null, TestNonNull, [
        {
          error: 'Expected value of non-null type "Int!" not to be null.',
          path: [],
        },
      ]);
    });
  });

  describe('for GraphQLScalar', () => {
    const TestScalar = new GraphQLScalarType({
      name: 'TestScalar',
      parseValue(input: any) {
        invariant(typeof input === 'object' && input !== null);
        if (input.error != null) {
          throw new Error(input.error);
        }
        return input.value;
      },
    });

    it('returns no error for valid input', () => {
      test({ value: 1 }, TestScalar, []);
    });

    it('returns no error for null result', () => {
      test({ value: null }, TestScalar, []);
    });

    it('returns no error for NaN result', () => {
      test({ value: NaN }, TestScalar, []);
    });

    it('returns an error for undefined result', () => {
      test({ value: undefined }, TestScalar, [
        {
          error:
            'Expected value of type "TestScalar", found: { value: undefined }.',
          path: [],
        },
      ]);
    });

    it('returns an error for undefined result', () => {
      const inputValue = { error: 'Some error message.' };
      test(inputValue, TestScalar, [
        {
          error:
            'Expected value of type "TestScalar", but encountered error "Some error message."; found: { error: "Some error message." }.',
          path: [],
        },
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
      test('FOO', TestEnum, []);

      test('BAR', TestEnum, []);
    });

    it('returns an error for unknown enum value', () => {
      test('UNKNOWN', TestEnum, [
        {
          error: 'Value "UNKNOWN" does not exist in "TestEnum" enum.',
          path: [],
        },
      ]);
    });

    it('returns an error for misspelled enum value', () => {
      test('foo', TestEnum, [
        {
          error:
            'Value "foo" does not exist in "TestEnum" enum. Did you mean the enum value "FOO"?',
          path: [],
        },
      ]);
    });

    it('returns an error for misspelled enum value (no suggestions)', () => {
      test(
        'foo',
        TestEnum,
        [
          {
            error: 'Value "foo" does not exist in "TestEnum" enum.',
            path: [],
          },
        ],
        true,
      );
    });

    it('returns an error for incorrect value type', () => {
      class Foo {
        toJSON() {
          return 'FOO';
        }
      }

      test(new Foo(), TestEnum, [
        {
          error:
            'Enum "TestEnum" cannot represent non-string value: FOO. Did you mean the enum value "FOO"?',
          path: [],
        },
      ]);

      test(
        new Foo(),
        TestEnum,
        [
          {
            error: 'Enum "TestEnum" cannot represent non-string value: FOO.',
            path: [],
          },
        ],
        true,
      );

      test(123, TestEnum, [
        {
          error: 'Enum "TestEnum" cannot represent non-string value: 123.',
          path: [],
        },
      ]);

      test({ field: 'value' }, TestEnum, [
        {
          error:
            'Enum "TestEnum" cannot represent non-string value: { field: "value" }.',
          path: [],
        },
      ]);
    });

    it('reports thrown non-error', () => {
      const TestThrowScalar = new GraphQLScalarType({
        name: 'TestScalar',
        parseValue() {
          // eslint-disable-next-line no-throw-literal, @typescript-eslint/only-throw-error
          throw 'Not an error object.';
        },
      });

      test({}, TestThrowScalar, [
        {
          error:
            'Expected value of type "TestScalar", but encountered error "Not an error object."; found: {}.',
          path: [],
        },
      ]);
    });
  });

  describe('for GraphQLInputObject', () => {
    const TestInputObject = new GraphQLInputObjectType({
      name: 'TestInputObject',
      fields: {
        foo: { type: new GraphQLNonNull(GraphQLInt) },
        bar: { type: GraphQLInt },
      },
    });

    it('returns no error for a valid input', () => {
      test({ foo: 123 }, TestInputObject, []);
    });

    it('returns an error for a non-object type', () => {
      test(123, TestInputObject, [
        {
          error:
            'Expected value of type "TestInputObject" to be an object, found: 123.',
          path: [],
        },
      ]);
    });

    it('returns an error for an invalid field', () => {
      test({ foo: NaN }, TestInputObject, [
        {
          error: 'Int cannot represent non-integer value: NaN',
          path: ['foo'],
        },
      ]);
    });

    it('returns multiple errors for multiple invalid fields', () => {
      test({ foo: 'abc', bar: 'def' }, TestInputObject, [
        {
          error: 'Int cannot represent non-integer value: "abc"',
          path: ['foo'],
        },
        {
          error: 'Int cannot represent non-integer value: "def"',
          path: ['bar'],
        },
      ]);
    });

    it('returns error for a missing required field', () => {
      test({ bar: 123 }, TestInputObject, [
        {
          error:
            'Expected value of type "TestInputObject" to include required field "foo", found: { bar: 123 }.',
          path: [],
        },
      ]);
    });

    it('returns error for an unknown field', () => {
      test({ foo: 123, unknownField: 123 }, TestInputObject, [
        {
          error:
            'Expected value of type "TestInputObject" not to include unknown field "unknownField", found: { foo: 123, unknownField: 123 }.',
          path: [],
        },
      ]);
    });

    it('returns error for a misspelled field', () => {
      test({ foo: 123, bart: 123 }, TestInputObject, [
        {
          error:
            'Expected value of type "TestInputObject" not to include unknown field "bart". Did you mean "bar"? Found: { foo: 123, bart: 123 }.',
          path: [],
        },
      ]);
    });

    it('returns error for a misspelled field (no suggestions)', () => {
      test(
        { foo: 123, bart: 123 },
        TestInputObject,
        [
          {
            error:
              'Expected value of type "TestInputObject" not to include unknown field "bart", found: { foo: 123, bart: 123 }.',
            path: [],
          },
        ],
        true,
      );
    });
  });

  describe('for GraphQLInputObject with default value', () => {
    function makeTestInputObject(defaultValue: unknown) {
      return new GraphQLInputObjectType({
        name: 'TestInputObject',
        fields: {
          foo: {
            type: new GraphQLScalarType({ name: 'TestScalar' }),
            default: { value: defaultValue },
          },
        },
      });
    }

    it('no error for no errors for valid input value', () => {
      test({ foo: 5 }, makeTestInputObject(7), []);
    });

    it('no error for object with default value', () => {
      test({}, makeTestInputObject(7), []);
    });

    it('no error for null as value', () => {
      test({}, makeTestInputObject(null), []);
    });

    it('no error for NaN as value', () => {
      test({}, makeTestInputObject(NaN), []);
    });
  });

  describe('for GraphQLList', () => {
    const TestList = new GraphQLList(GraphQLInt);

    it('returns no error for a valid input', () => {
      test([1, 2, 3], TestList, []);
    });

    it('returns no error for a valid iterable input', () => {
      // TODO: put an error in this list and show it appears
      function* listGenerator() {
        yield 1;
        yield 2;
        yield 3;
      }

      test(listGenerator(), TestList, []);
    });

    it('returns an error for an invalid input', () => {
      test([1, 'b', true, 4], TestList, [
        {
          error: 'Int cannot represent non-integer value: "b"',
          path: [1],
        },
        {
          error: 'Int cannot represent non-integer value: true',
          path: [2],
        },
      ]);
    });

    it('no error for a list for a non-list value', () => {
      test(42, TestList, []);
    });

    it('returns an error for a non-list invalid value', () => {
      test('INVALID', TestList, [
        {
          error: 'Int cannot represent non-integer value: "INVALID"',
          path: [],
        },
      ]);
    });

    it('no error for null for a null value', () => {
      test(null, TestList, []);
    });
  });

  describe('for nested GraphQLList', () => {
    const TestNestedList = new GraphQLList(new GraphQLList(GraphQLInt));

    it('no error for a valid input', () => {
      test([[1], [2, 3]], TestNestedList, []);
    });

    it('no error for a list for a non-list value', () => {
      test(42, TestNestedList, []);
    });

    it('no error for null for a null value', () => {
      test(null, TestNestedList, []);
    });

    it('no error for nested lists for nested non-list values', () => {
      test([1, 2, 3], TestNestedList, []);
    });

    it('no error for nested null for nested null values', () => {
      test([42, [null], null], TestNestedList, []);
    });
  });
});

describe('validateInputLiteral', () => {
  function test(
    inputValue: string,
    type: GraphQLInputType,
    expected: unknown,
    variableValues?: VariableValues,
    hideSuggestions = false,
  ) {
    const errors: any = [];
    validateInputLiteral(
      parseValue(inputValue),
      type,
      (error, path) => {
        errors.push({ error: error.message, path });
      },
      variableValues,
      undefined,
      hideSuggestions,
    );
    expect(errors).to.deep.equal(expected);
  }

  function testWithVariables(
    variableDefs: string,
    values: ReadOnlyObjMap<unknown>,
    inputValue: string,
    type: GraphQLInputType,
    expected: unknown,
  ) {
    const parser = new Parser(variableDefs);
    parser.expectToken(TokenKind.SOF);
    const variableValuesOrErrors = getVariableValues(
      new GraphQLSchema({ types: [GraphQLInt] }),
      parser.parseVariableDefinitions() ?? [],
      values,
    );
    invariant(variableValuesOrErrors.variableValues != null);
    test(inputValue, type, expected, variableValuesOrErrors.variableValues);
  }

  it('ignores variables statically', () => {
    const TestNonNull = new GraphQLNonNull(GraphQLInt);
    test('$var', TestNonNull, []);
  });

  it('returns an error for null variables for non-nullable types', () => {
    const TestNonNull = new GraphQLNonNull(GraphQLInt);
    testWithVariables('($var: Int)', { var: null }, '$var', TestNonNull, [
      {
        error:
          'Expected variable "$var" provided to non-null type "Int!" not to be null.',
        path: [],
      },
    ]);
  });

  describe('for GraphQLNonNull', () => {
    const TestNonNull = new GraphQLNonNull(GraphQLInt);

    it('returns no error for non-null value', () => {
      test('1', TestNonNull, []);
    });

    it('returns an error for null value', () => {
      test('null', TestNonNull, [
        {
          error: 'Expected value of non-null type "Int!" not to be null.',
          path: [],
        },
      ]);
    });
  });

  describe('for GraphQLScalar', () => {
    const TestScalar = new GraphQLScalarType({
      name: 'TestScalar',
      parseValue(input: any) {
        invariant(typeof input === 'object' && input !== null);
        if (input.error != null) {
          throw new Error(input.error);
        }
        return input.value;
      },
    });

    it('returns no error for valid input', () => {
      test('{ value: 1 }', TestScalar, []);
    });

    it('returns no error for null result', () => {
      test('{ value: null }', TestScalar, []);
    });

    it('returns no error for NaN result', () => {
      test('{ value: NaN }', TestScalar, []);
    });

    it('returns an error for undefined result', () => {
      test('{}', TestScalar, [
        {
          error: 'Expected value of type "TestScalar", found: {  }.',
          path: [],
        },
      ]);
    });

    it('returns an error for undefined result', () => {
      const inputValue = '{ error: "Some error message." }';
      test(inputValue, TestScalar, [
        {
          error:
            'Expected value of type "TestScalar", but encountered error "Some error message."; found: { error: "Some error message." }.',
          path: [],
        },
      ]);
    });

    it('reports thrown non-error', () => {
      const TestThrowScalar = new GraphQLScalarType({
        name: 'TestScalar',
        parseValue() {
          // eslint-disable-next-line no-throw-literal, @typescript-eslint/only-throw-error
          throw 'Not an error object.';
        },
      });

      test('{}', TestThrowScalar, [
        {
          error:
            'Expected value of type "TestScalar", but encountered error "Not an error object."; found: {  }.',
          path: [],
        },
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
      test('FOO', TestEnum, []);

      test('BAR', TestEnum, []);
    });

    it('returns an error for unknown enum value', () => {
      test('UNKNOWN', TestEnum, [
        {
          error: 'Value "UNKNOWN" does not exist in "TestEnum" enum.',
          path: [],
        },
      ]);
    });

    it('returns an error for misspelled enum value', () => {
      test('foo', TestEnum, [
        {
          error:
            'Value "foo" does not exist in "TestEnum" enum. Did you mean the enum value "FOO"?',
          path: [],
        },
      ]);
    });

    it('returns an error for misspelled enum value (no suggestions)', () => {
      test(
        'foo',
        TestEnum,
        [
          {
            error: 'Value "foo" does not exist in "TestEnum" enum.',
            path: [],
          },
        ],
        undefined,
        true,
      );
    });

    it('returns an error for incorrect value type', () => {
      test('"FOO"', TestEnum, [
        {
          error:
            'Enum "TestEnum" cannot represent non-enum value: "FOO". Did you mean the enum value "FOO"?',
          path: [],
        },
      ]);

      test(
        '"FOO"',
        TestEnum,
        [
          {
            error: 'Enum "TestEnum" cannot represent non-enum value: "FOO".',
            path: [],
          },
        ],
        undefined,
        true,
      );

      test('"UNKNOWN"', TestEnum, [
        {
          error: 'Enum "TestEnum" cannot represent non-enum value: "UNKNOWN".',
          path: [],
        },
      ]);

      test('123', TestEnum, [
        {
          error: 'Enum "TestEnum" cannot represent non-enum value: 123.',
          path: [],
        },
      ]);

      test('{ field: "value" }', TestEnum, [
        {
          error:
            'Enum "TestEnum" cannot represent non-enum value: { field: "value" }.',
          path: [],
        },
      ]);
    });
  });

  describe('for GraphQLInputObject', () => {
    const TestInputObject = new GraphQLInputObjectType({
      name: 'TestInputObject',
      fields: {
        foo: { type: new GraphQLNonNull(GraphQLInt) },
        bar: { type: GraphQLInt },
        optional: {
          type: new GraphQLNonNull(GraphQLInt),
          default: { value: 42 },
        },
      },
    });

    it('returns no error for a valid input', () => {
      test('{ foo: 123 }', TestInputObject, []);
    });

    it('returns an error for a non-object type', () => {
      test('123', TestInputObject, [
        {
          error:
            'Expected value of type "TestInputObject" to be an object, found: 123.',
          path: [],
        },
      ]);
    });

    it('returns an error for an invalid field', () => {
      test('{ foo: 1.5 }', TestInputObject, [
        {
          error: 'Int cannot represent non-integer value: 1.5',
          path: ['foo'],
        },
      ]);
    });

    it('returns multiple errors for multiple invalid fields', () => {
      test('{ foo: "abc", bar: "def" }', TestInputObject, [
        {
          error: 'Int cannot represent non-integer value: "abc"',
          path: ['foo'],
        },
        {
          error: 'Int cannot represent non-integer value: "def"',
          path: ['bar'],
        },
      ]);
    });

    it('returns error for a missing required field', () => {
      test('{ bar: 123 }', TestInputObject, [
        {
          error:
            'Expected value of type "TestInputObject" to include required field "foo", found: { bar: 123 }.',
          path: [],
        },
      ]);
    });

    it('returns error for an unknown field', () => {
      test('{ foo: 123, unknownField: 123 }', TestInputObject, [
        {
          error:
            'Expected value of type "TestInputObject" not to include unknown field "unknownField", found: { foo: 123, unknownField: 123 }.',
          path: [],
        },
      ]);
    });

    it('returns error for a misspelled field', () => {
      test('{ foo: 123, bart: 123 }', TestInputObject, [
        {
          error:
            'Expected value of type "TestInputObject" not to include unknown field "bart". Did you mean "bar"? Found: { foo: 123, bart: 123 }.',
          path: [],
        },
      ]);
    });

    it('allows variables in an object, statically', () => {
      test('{ foo: $var }', TestInputObject, []);
    });

    it('allows correct use of variables', () => {
      testWithVariables(
        '($var: Int)',
        { var: 123 },
        '{ foo: $var }',
        TestInputObject,
        [],
      );
    });

    it('allows missing variables in an nullable field', () => {
      testWithVariables('', {}, '{ foo: 123, bar: $var }', TestInputObject, []);
      testWithVariables(
        '($var: Int)',
        {},
        '{ foo: 123, bar: $var }',
        TestInputObject,
        [],
      );
    });

    it('allows missing variables in an optional field', () => {
      testWithVariables(
        '($var: Int)',
        {},
        '{ foo: 123, optional: $var }',
        TestInputObject,
        [],
      );
    });

    it('errors on missing variable in an required field', () => {
      testWithVariables('($var: Int)', {}, '{ foo: $var }', TestInputObject, [
        {
          error:
            'Expected variable "$var" provided to type "Int!" to provide a runtime value.',
          path: ['foo'],
        },
      ]);
    });

    it('errors on null variable in an non-null field', () => {
      testWithVariables(
        '($var: Int)',
        { var: null },
        '{ foo: 123, optional: $var }',
        TestInputObject,
        [
          {
            error:
              'Expected variable "$var" provided to non-null type "Int!" not to be null.',
            path: ['optional'],
          },
        ],
      );
    });
  });

  describe('for GraphQLInputObject with default value', () => {
    function makeTestInputObject(defaultValue: unknown) {
      return new GraphQLInputObjectType({
        name: 'TestInputObject',
        fields: {
          foo: {
            type: new GraphQLScalarType({ name: 'TestScalar' }),
            default: { value: defaultValue },
          },
        },
      });
    }

    it('no error for no errors for valid input value', () => {
      test('{ foo: 5 }', makeTestInputObject(7), []);
    });

    it('no error for object with default value', () => {
      test('{}', makeTestInputObject(7), []);
    });

    it('no error for null as value', () => {
      test('{}', makeTestInputObject(null), []);
    });

    it('no error for NaN as value', () => {
      test('{}', makeTestInputObject(NaN), []);
    });
  });

  describe('for GraphQLList', () => {
    const TestList = new GraphQLList(GraphQLInt);

    it('returns no error for a valid input', () => {
      test('[1, 2, 3]', TestList, []);
    });

    it('returns an error for an invalid input', () => {
      test('[1, "b", true, 4]', TestList, [
        {
          error: 'Int cannot represent non-integer value: "b"',
          path: [1],
        },
        {
          error: 'Int cannot represent non-integer value: true',
          path: [2],
        },
      ]);
    });

    it('no error for a list for a non-list value', () => {
      test('42', TestList, []);
    });

    it('returns an error for a non-list invalid value', () => {
      test('"INVALID"', TestList, [
        {
          error: 'Int cannot represent non-integer value: "INVALID"',
          path: [],
        },
      ]);
    });

    it('no error for null for a null value', () => {
      test('null', TestList, []);
    });

    it('allows variables in a list, statically', () => {
      test('[1, $var, 3]', TestList, []);
    });

    it('allows missing variables in a list (which coerce to null)', () => {
      testWithVariables('($var: Int)', {}, '[1, $var, 3]', TestList, []);
    });

    it('errors on missing variables in a list of non-null', () => {
      const TestListNonNull = new GraphQLList(new GraphQLNonNull(GraphQLInt));
      testWithVariables('($var: Int)', {}, '[1, $var, 3]', TestListNonNull, [
        {
          error:
            'Expected variable "$var" provided to type "Int!" to provide a runtime value.',
          path: [1],
        },
      ]);
    });

    it('errors on null variables in a list of non-null', () => {
      const TestListNonNull = new GraphQLList(new GraphQLNonNull(GraphQLInt));
      testWithVariables(
        '($var: Int)',
        { var: null },
        '[1, $var, 3]',
        TestListNonNull,
        [
          {
            error:
              'Expected variable "$var" provided to non-null type "Int!" not to be null.',
            path: [1],
          },
        ],
      );
    });
  });

  describe('for nested GraphQLList', () => {
    const TestNestedList = new GraphQLList(new GraphQLList(GraphQLInt));

    it('no error for a valid input', () => {
      test('[[1], [2, 3]]', TestNestedList, []);
    });

    it('no error for a list for a non-list value', () => {
      test('42', TestNestedList, []);
    });

    it('no error for null for a null value', () => {
      test('null', TestNestedList, []);
    });

    it('no error for nested lists for nested non-list values', () => {
      test('[1, 2, 3]', TestNestedList, []);
    });

    it('no error for nested null for nested null values', () => {
      test('[42, [null], null]', TestNestedList, []);
    });
  });
});
