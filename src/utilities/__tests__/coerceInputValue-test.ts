import { expect } from 'chai';
import { describe, it } from 'mocha';

import { identityFunc } from '../../jsutils/identityFunc.js';
import { invariant } from '../../jsutils/invariant.js';
import type { ReadOnlyObjMap } from '../../jsutils/ObjMap.js';

import { Kind } from '../../language/kinds.js';
import { Parser, parseValue } from '../../language/parser.js';
import { print } from '../../language/printer.js';
import { TokenKind } from '../../language/tokenKind.js';

import type { GraphQLInputType } from '../../type/definition.js';
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
} from '../../type/definition.js';
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
} from '../../type/scalars.js';
import { GraphQLSchema } from '../../type/schema.js';

import type { VariableValues } from '../../execution/values.js';
import { getVariableValues } from '../../execution/values.js';

import {
  coerceDefaultValue,
  coerceInputLiteral,
  coerceInputValue,
} from '../coerceInputValue.js';

interface CoerceResult {
  value: unknown;
  errors: ReadonlyArray<CoerceError>;
}

interface CoerceError {
  path: ReadonlyArray<string | number>;
  value: unknown;
  error: string;
}

function coerceValue(
  inputValue: unknown,
  type: GraphQLInputType,
): CoerceResult {
  const errors: Array<CoerceError> = [];
  const value = coerceInputValue(
    inputValue,
    type,
    true,
    (path, invalidValue, error) => {
      errors.push({ path, value: invalidValue, error: error.message });
    },
  );

  return { errors, value };
}

function expectValue(result: CoerceResult) {
  expect(result.errors).to.deep.equal([]);
  return expect(result.value);
}

function expectErrors(result: CoerceResult) {
  return expect(result.errors);
}

describe('coerceInputValue', () => {
  describe('for GraphQLNonNull', () => {
    const TestNonNull = new GraphQLNonNull(GraphQLInt);

    it('returns no error for non-null value', () => {
      const result = coerceValue(1, TestNonNull);
      expectValue(result).to.equal(1);
    });

    it('returns an error for undefined value', () => {
      const result = coerceValue(undefined, TestNonNull);
      expectErrors(result).to.deep.equal([
        {
          error: 'Expected non-nullable type "Int!" not to be null.',
          path: [],
          value: undefined,
        },
      ]);
    });

    it('returns an error for null value', () => {
      const result = coerceValue(null, TestNonNull);
      expectErrors(result).to.deep.equal([
        {
          error: 'Expected non-nullable type "Int!" not to be null.',
          path: [],
          value: null,
        },
      ]);
    });
  });

  describe('for GraphQLScalar', () => {
    const TestScalar = new GraphQLScalarType({
      name: 'TestScalar',
      parseValue(input: any) {
        if (input.error != null) {
          throw new Error(input.error);
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
      expectErrors(result).to.deep.equal([
        {
          error: 'Expected type "TestScalar".',
          path: [],
          value: { value: undefined },
        },
      ]);
    });

    it('returns a thrown error', () => {
      const inputValue = { error: 'Some error message' };
      const result = coerceValue(inputValue, TestScalar);
      expectErrors(result).to.deep.equal([
        {
          error: 'Expected type "TestScalar". Some error message',
          path: [],
          value: { error: 'Some error message' },
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
      const fooResult = coerceValue('FOO', TestEnum);
      expectValue(fooResult).to.equal('InternalFoo');

      const barResult = coerceValue('BAR', TestEnum);
      expectValue(barResult).to.equal(123456789);
    });

    it('returns an error for misspelled enum value', () => {
      const result = coerceValue('foo', TestEnum);
      expectErrors(result).to.deep.equal([
        {
          error:
            'Value "foo" does not exist in "TestEnum" enum. Did you mean the enum value "FOO"?',
          path: [],
          value: 'foo',
        },
      ]);
    });

    it('returns an error for incorrect value type', () => {
      const result1 = coerceValue(123, TestEnum);
      expectErrors(result1).to.deep.equal([
        {
          error: 'Enum "TestEnum" cannot represent non-string value: 123.',
          path: [],
          value: 123,
        },
      ]);

      const result2 = coerceValue({ field: 'value' }, TestEnum);
      expectErrors(result2).to.deep.equal([
        {
          error:
            'Enum "TestEnum" cannot represent non-string value: { field: "value" }.',
          path: [],
          value: { field: 'value' },
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
      const result = coerceValue({ foo: 123 }, TestInputObject);
      expectValue(result).to.deep.equal({ foo: 123 });
    });

    it('returns an error for a non-object type', () => {
      const result = coerceValue(123, TestInputObject);
      expectErrors(result).to.deep.equal([
        {
          error: 'Expected type "TestInputObject" to be an object.',
          path: [],
          value: 123,
        },
      ]);
    });

    it('returns an error for an invalid field', () => {
      const result = coerceValue({ foo: NaN }, TestInputObject);
      expectErrors(result).to.deep.equal([
        {
          error: 'Int cannot represent non-integer value: NaN',
          path: ['foo'],
          value: NaN,
        },
      ]);
    });

    it('returns multiple errors for multiple invalid fields', () => {
      const result = coerceValue({ foo: 'abc', bar: 'def' }, TestInputObject);
      expectErrors(result).to.deep.equal([
        {
          error: 'Int cannot represent non-integer value: "abc"',
          path: ['foo'],
          value: 'abc',
        },
        {
          error: 'Int cannot represent non-integer value: "def"',
          path: ['bar'],
          value: 'def',
        },
      ]);
    });

    it('returns error for a missing required field', () => {
      const result = coerceValue({ bar: 123 }, TestInputObject);
      expectErrors(result).to.deep.equal([
        {
          error:
            'Field "TestInputObject.foo" of required type "Int!" was not provided.',
          path: [],
          value: { bar: 123 },
        },
      ]);
    });

    it('returns error for an unknown field', () => {
      const result = coerceValue(
        { foo: 123, unknownField: 123 },
        TestInputObject,
      );
      expectErrors(result).to.deep.equal([
        {
          error:
            'Field "unknownField" is not defined by type "TestInputObject".',
          path: [],
          value: { foo: 123, unknownField: 123 },
        },
      ]);
    });

    it('returns error for a misspelled field', () => {
      const result = coerceValue({ foo: 123, bart: 123 }, TestInputObject);
      expectErrors(result).to.deep.equal([
        {
          error:
            'Field "bart" is not defined by type "TestInputObject". Did you mean "bar"?',
          path: [],
          value: { foo: 123, bart: 123 },
        },
      ]);
    });
  });

  describe('for GraphQLInputObject that isOneOf', () => {
    const TestInputObject = new GraphQLInputObjectType({
      name: 'TestInputObject',
      fields: {
        foo: { type: GraphQLInt },
        bar: { type: GraphQLInt },
      },
      isOneOf: true,
    });

    it('returns no error for a valid input', () => {
      const result = coerceValue({ foo: 123 }, TestInputObject);
      expectValue(result).to.deep.equal({ foo: 123 });
    });

    it('returns an error if more than one field is specified', () => {
      const result = coerceValue({ foo: 123, bar: null }, TestInputObject);
      expectErrors(result).to.deep.equal([
        {
          error:
            'Exactly one key must be specified for OneOf type "TestInputObject".',
          path: [],
          value: { foo: 123, bar: null },
        },
      ]);
    });

    it('returns an error the one field is null', () => {
      const result = coerceValue({ bar: null }, TestInputObject);
      expectErrors(result).to.deep.equal([
        {
          error: 'Field "bar" must be non-null.',
          path: ['bar'],
          value: null,
        },
      ]);
    });

    it('returns an error for an invalid field', () => {
      const result = coerceValue({ foo: NaN }, TestInputObject);
      expectErrors(result).to.deep.equal([
        {
          error: 'Int cannot represent non-integer value: NaN',
          path: ['foo'],
          value: NaN,
        },
      ]);
    });

    it('returns multiple errors for multiple invalid fields', () => {
      const result = coerceValue({ foo: 'abc', bar: 'def' }, TestInputObject);
      expectErrors(result).to.deep.equal([
        {
          error: 'Int cannot represent non-integer value: "abc"',
          path: ['foo'],
          value: 'abc',
        },
        {
          error: 'Int cannot represent non-integer value: "def"',
          path: ['bar'],
          value: 'def',
        },
        {
          error:
            'Exactly one key must be specified for OneOf type "TestInputObject".',
          path: [],
          value: { foo: 'abc', bar: 'def' },
        },
      ]);
    });

    it('returns error for an unknown field', () => {
      const result = coerceValue(
        { foo: 123, unknownField: 123 },
        TestInputObject,
      );
      expectErrors(result).to.deep.equal([
        {
          error:
            'Field "unknownField" is not defined by type "TestInputObject".',
          path: [],
          value: { foo: 123, unknownField: 123 },
        },
      ]);
    });

    it('returns error for a misspelled field', () => {
      const result = coerceValue({ bart: 123 }, TestInputObject);
      expectErrors(result).to.deep.equal([
        {
          error:
            'Field "bart" is not defined by type "TestInputObject". Did you mean "bar"?',
          path: [],
          value: { bart: 123 },
        },
        {
          error:
            'Exactly one key must be specified for OneOf type "TestInputObject".',
          path: [],
          value: { bart: 123 },
        },
      ]);
    });
  });

  describe('for GraphQLInputObject with default value', () => {
    const makeTestInputObject = (defaultValue: any) =>
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
      const result = coerceValue({ foo: 5 }, makeTestInputObject(7));
      expectValue(result).to.deep.equal({ foo: 5 });
    });

    it('returns object with default value', () => {
      const result = coerceValue({}, makeTestInputObject(7));
      expectValue(result).to.deep.equal({ foo: 7 });
    });

    it('returns null as value', () => {
      const result = coerceValue({}, makeTestInputObject(null));
      expectValue(result).to.deep.equal({ foo: null });
    });

    it('returns NaN as value', () => {
      const result = coerceValue({}, makeTestInputObject(NaN));
      expectValue(result).to.have.property('foo').that.satisfy(Number.isNaN);
    });
  });

  describe('for GraphQLList', () => {
    const TestList = new GraphQLList(GraphQLInt);

    it('returns no error for a valid input', () => {
      const result = coerceValue([1, 2, 3], TestList);
      expectValue(result).to.deep.equal([1, 2, 3]);
    });

    it('returns no error for a valid iterable input', () => {
      function* listGenerator() {
        yield 1;
        yield 2;
        yield 3;
      }

      const result = coerceValue(listGenerator(), TestList);
      expectValue(result).to.deep.equal([1, 2, 3]);
    });

    it('returns an error for an invalid input', () => {
      const result = coerceValue([1, 'b', true, 4], TestList);
      expectErrors(result).to.deep.equal([
        {
          error: 'Int cannot represent non-integer value: "b"',
          path: [1],
          value: 'b',
        },
        {
          error: 'Int cannot represent non-integer value: true',
          path: [2],
          value: true,
        },
      ]);
    });

    it('returns a list for a non-list value', () => {
      const result = coerceValue(42, TestList);
      expectValue(result).to.deep.equal([42]);
    });

    it('returns a list for a non-list object value', () => {
      const TestListOfObjects = new GraphQLList(
        new GraphQLInputObjectType({
          name: 'TestObject',
          fields: {
            length: { type: GraphQLInt },
          },
        }),
      );

      const result = coerceValue({ length: 100500 }, TestListOfObjects);
      expectValue(result).to.deep.equal([{ length: 100500 }]);
    });

    it('returns an error for a non-list invalid value', () => {
      const result = coerceValue('INVALID', TestList);
      expectErrors(result).to.deep.equal([
        {
          error: 'Int cannot represent non-integer value: "INVALID"',
          path: [],
          value: 'INVALID',
        },
      ]);
    });

    it('returns null for a null value', () => {
      const result = coerceValue(null, TestList);
      expectValue(result).to.deep.equal(null);
    });
  });

  describe('for nested GraphQLList', () => {
    const TestNestedList = new GraphQLList(new GraphQLList(GraphQLInt));

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

  describe('with default onError', () => {
    it('throw error without path', () => {
      expect(() =>
        coerceInputValue(null, new GraphQLNonNull(GraphQLInt), true),
      ).to.throw(
        'Invalid value null: Expected non-nullable type "Int!" not to be null.',
      );
    });

    it('throw error with path', () => {
      expect(() =>
        coerceInputValue(
          [null],
          new GraphQLList(new GraphQLNonNull(GraphQLInt)),
          true,
        ),
      ).to.throw(
        'Invalid value null at "value[0]": Expected non-nullable type "Int!" not to be null.',
      );
    });
  });
});

describe('coerceInputLiteral', () => {
  function test(
    valueText: string,
    type: GraphQLInputType,
    expected: unknown,
    variableValues?: VariableValues,
  ) {
    const ast = parseValue(valueText);
    const value = coerceInputLiteral(ast, type, true, variableValues);
    expect(value).to.deep.equal(expected);
  }

  function testWithVariables(
    variableDefs: string,
    inputs: ReadOnlyObjMap<unknown>,
    valueText: string,
    type: GraphQLInputType,
    expected: unknown,
  ) {
    const parser = new Parser(variableDefs);
    parser.expectToken(TokenKind.SOF);
    const variableValuesOrErrors = getVariableValues(
      new GraphQLSchema({}),
      parser.parseVariableDefinitions(),
      inputs,
    );
    invariant(variableValuesOrErrors.variableValues !== undefined);
    test(valueText, type, expected, variableValuesOrErrors.variableValues);
  }

  it('converts according to input coercion rules', () => {
    test('true', GraphQLBoolean, true);
    test('false', GraphQLBoolean, false);
    test('123', GraphQLInt, 123);
    test('123', GraphQLFloat, 123);
    test('123.456', GraphQLFloat, 123.456);
    test('"abc123"', GraphQLString, 'abc123');
    test('123456', GraphQLID, '123456');
    test('"123456"', GraphQLID, '123456');
  });

  it('does not convert when input coercion rules reject a value', () => {
    test('123', GraphQLBoolean, undefined);
    test('123.456', GraphQLInt, undefined);
    test('true', GraphQLInt, undefined);
    test('"123"', GraphQLInt, undefined);
    test('"123"', GraphQLFloat, undefined);
    test('123', GraphQLString, undefined);
    test('true', GraphQLString, undefined);
    test('123.456', GraphQLString, undefined);
    test('123.456', GraphQLID, undefined);
  });

  it('convert using parseConstLiteral from a custom scalar type', () => {
    const passthroughScalar = new GraphQLScalarType({
      name: 'PassthroughScalar',
      parseConstLiteral(node) {
        invariant(node.kind === 'StringValue');
        return node.value;
      },
      parseValue: identityFunc,
    });

    test('"value"', passthroughScalar, 'value');

    const printScalar = new GraphQLScalarType({
      name: 'PrintScalar',
      parseConstLiteral(node) {
        return `~~~${print(node)}~~~`;
      },
      parseValue: identityFunc,
    });

    test('"value"', printScalar, '~~~"value"~~~');
    testWithVariables(
      '($var: String)',
      { var: 'value' },
      '{ field: $var }',
      printScalar,
      '~~~{ field: "value" }~~~',
    );

    const throwScalar = new GraphQLScalarType({
      name: 'ThrowScalar',
      parseConstLiteral() {
        throw new Error('Test');
      },
      parseValue: identityFunc,
    });

    test('value', throwScalar, undefined);

    const returnUndefinedScalar = new GraphQLScalarType({
      name: 'ReturnUndefinedScalar',
      parseConstLiteral() {
        return undefined;
      },
      parseValue: identityFunc,
    });

    test('value', returnUndefinedScalar, undefined);
  });

  it('converts enum values according to input coercion rules', () => {
    const testEnum = new GraphQLEnumType({
      name: 'TestColor',
      values: {
        RED: { value: 1 },
        GREEN: { value: 2 },
        BLUE: { value: 3 },
        NULL: { value: null },
        NAN: { value: NaN },
        NO_CUSTOM_VALUE: { value: undefined },
      },
    });

    test('RED', testEnum, 1);
    test('BLUE', testEnum, 3);
    test('3', testEnum, undefined);
    test('"BLUE"', testEnum, undefined);
    test('null', testEnum, null);
    test('NULL', testEnum, null);
    test('NULL', new GraphQLNonNull(testEnum), null);
    test('NAN', testEnum, NaN);
    test('NO_CUSTOM_VALUE', testEnum, 'NO_CUSTOM_VALUE');
  });

  // Boolean!
  const nonNullBool = new GraphQLNonNull(GraphQLBoolean);
  // [Boolean]
  const listOfBool = new GraphQLList(GraphQLBoolean);
  // [Boolean!]
  const listOfNonNullBool = new GraphQLList(nonNullBool);
  // [Boolean]!
  const nonNullListOfBool = new GraphQLNonNull(listOfBool);
  // [Boolean!]!
  const nonNullListOfNonNullBool = new GraphQLNonNull(listOfNonNullBool);

  it('coerces to null unless non-null', () => {
    test('null', GraphQLBoolean, null);
    test('null', nonNullBool, undefined);
  });

  it('coerces lists of values', () => {
    test('true', listOfBool, [true]);
    test('123', listOfBool, undefined);
    test('null', listOfBool, null);
    test('[true, false]', listOfBool, [true, false]);
    test('[true, 123]', listOfBool, undefined);
    test('[true, null]', listOfBool, [true, null]);
    test('{ true: true }', listOfBool, undefined);
  });

  it('coerces non-null lists of values', () => {
    test('true', nonNullListOfBool, [true]);
    test('123', nonNullListOfBool, undefined);
    test('null', nonNullListOfBool, undefined);
    test('[true, false]', nonNullListOfBool, [true, false]);
    test('[true, 123]', nonNullListOfBool, undefined);
    test('[true, null]', nonNullListOfBool, [true, null]);
  });

  it('coerces lists of non-null values', () => {
    test('true', listOfNonNullBool, [true]);
    test('123', listOfNonNullBool, undefined);
    test('null', listOfNonNullBool, null);
    test('[true, false]', listOfNonNullBool, [true, false]);
    test('[true, 123]', listOfNonNullBool, undefined);
    test('[true, null]', listOfNonNullBool, undefined);
  });

  it('coerces non-null lists of non-null values', () => {
    test('true', nonNullListOfNonNullBool, [true]);
    test('123', nonNullListOfNonNullBool, undefined);
    test('null', nonNullListOfNonNullBool, undefined);
    test('[true, false]', nonNullListOfNonNullBool, [true, false]);
    test('[true, 123]', nonNullListOfNonNullBool, undefined);
    test('[true, null]', nonNullListOfNonNullBool, undefined);
  });

  it('uses default values for unprovided fields', () => {
    const type = new GraphQLInputObjectType({
      name: 'TestInput',
      fields: {
        int: { type: GraphQLInt, defaultValue: 42 },
        float: {
          type: GraphQLFloat,
          defaultValueLiteral: { kind: Kind.FLOAT, value: '3.14' },
        },
      },
    });

    test('{}', type, { int: 42, float: 3.14 });
  });

  const testInputObj = new GraphQLInputObjectType({
    name: 'TestInput',
    fields: {
      int: { type: GraphQLInt, defaultValue: 42 },
      bool: { type: GraphQLBoolean },
      requiredBool: { type: nonNullBool },
    },
  });
  const testOneOfInputObj = new GraphQLInputObjectType({
    name: 'TestOneOfInput',
    fields: {
      a: { type: GraphQLString },
      b: { type: GraphQLString },
    },
    isOneOf: true,
  });

  it('coerces input objects according to input coercion rules', () => {
    test('null', testInputObj, null);
    test('123', testInputObj, undefined);
    test('[]', testInputObj, undefined);
    test('{ requiredBool: true }', testInputObj, {
      int: 42,
      requiredBool: true,
    });
    test('{ int: null, requiredBool: true }', testInputObj, {
      int: null,
      requiredBool: true,
    });
    test('{ int: 123, requiredBool: false }', testInputObj, {
      int: 123,
      requiredBool: false,
    });
    test('{ bool: true, requiredBool: false }', testInputObj, {
      int: 42,
      bool: true,
      requiredBool: false,
    });
    test('{ int: true, requiredBool: true }', testInputObj, undefined);
    test('{ requiredBool: null }', testInputObj, undefined);
    test('{ bool: true }', testInputObj, undefined);
    test('{ requiredBool: true, unknown: 123 }', testInputObj, undefined);
    test('{ a: "abc" }', testOneOfInputObj, {
      a: 'abc',
    });
    test('{ b: "def" }', testOneOfInputObj, {
      b: 'def',
    });
    test('{ a: "abc", b: null }', testOneOfInputObj, undefined);
    test('{ a: null }', testOneOfInputObj, undefined);
    test('{ a: 1 }', testOneOfInputObj, undefined);
    test('{ a: "abc", b: "def" }', testOneOfInputObj, undefined);
    test('{}', testOneOfInputObj, undefined);
    test('{ c: "abc" }', testOneOfInputObj, undefined);
  });

  it('accepts variable values assuming already coerced', () => {
    test('$var', GraphQLBoolean, undefined);
    testWithVariables(
      '($var: Boolean)',
      { var: true },
      '$var',
      GraphQLBoolean,
      true,
    );
    testWithVariables(
      '($var: Boolean)',
      { var: null },
      '$var',
      GraphQLBoolean,
      null,
    );
    testWithVariables(
      '($var: Boolean)',
      { var: null },
      '$var',
      nonNullBool,
      undefined,
    );
  });

  it('asserts variables are provided as items in lists', () => {
    test('[ $foo ]', listOfBool, [null]);
    test('[ $foo ]', listOfNonNullBool, undefined);
    testWithVariables(
      '($foo: Boolean)',
      { foo: true },
      '[ $foo ]',
      listOfNonNullBool,
      [true],
    );
    // Note: variables are expected to have already been coerced, so we
    // do not expect the singleton wrapping behavior for variables.
    testWithVariables(
      '($foo: Boolean)',
      { foo: true },
      '$foo',
      listOfNonNullBool,
      true,
    );
    testWithVariables(
      '($foo: [Boolean])',
      { foo: [true] },
      '$foo',
      listOfNonNullBool,
      [true],
    );
  });

  it('omits input object fields for unprovided variables', () => {
    test('{ int: $foo, bool: $foo, requiredBool: true }', testInputObj, {
      int: 42,
      requiredBool: true,
    });
    test('{ requiredBool: $foo }', testInputObj, undefined);
    testWithVariables(
      '($foo: Boolean)',
      { foo: true },
      '{ requiredBool: $foo }',
      testInputObj,
      { int: 42, requiredBool: true },
    );
  });
});

describe('coerceDefaultValue', () => {
  it('memoizes coercion', () => {
    const parseValueCalls: any = [];

    const spyScalar = new GraphQLScalarType({
      name: 'SpyScalar',
      parseValue(value) {
        parseValueCalls.push(value);
        return value;
      },
    });

    const defaultValueUsage = {
      literal: { kind: Kind.STRING, value: 'hello' },
    } as const;
    expect(coerceDefaultValue(defaultValueUsage, spyScalar, true)).to.equal(
      'hello',
    );

    // Call a second time
    expect(coerceDefaultValue(defaultValueUsage, spyScalar, true)).to.equal(
      'hello',
    );
    expect(parseValueCalls).to.deep.equal(['hello']);
  });
});
