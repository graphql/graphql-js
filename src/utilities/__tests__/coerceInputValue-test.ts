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

describe('coerceInputValue', () => {
  function test(
    inputValue: unknown,
    type: GraphQLInputType,
    expected: unknown,
  ) {
    expect(coerceInputValue(inputValue, type)).to.deep.equal(expected);
  }

  describe('for GraphQLNonNull', () => {
    const TestNonNull = new GraphQLNonNull(GraphQLInt);

    it('returns for a non-null value', () => {
      test(1, TestNonNull, 1);
    });

    it('invalid for undefined value', () => {
      test(undefined, TestNonNull, undefined);
    });

    it('invalid for null value', () => {
      test(null, TestNonNull, undefined);
    });
  });

  describe('for GraphQLScalar', () => {
    const TestScalar = new GraphQLScalarType({
      name: 'TestScalar',
      coerceInputValue(input: any) {
        if (input.error != null) {
          throw new Error(input.error);
        }
        return input.value;
      },
    });

    it('returns for valid input', () => {
      test({ value: 1 }, TestScalar, 1);
    });

    it('returns for null result', () => {
      test({ value: null }, TestScalar, null);
    });

    it('returns for NaN result', () => {
      expect(coerceInputValue({ value: NaN }, TestScalar)).to.satisfy(
        Number.isNaN,
      );
    });

    it('invalid for undefined result', () => {
      test({ value: undefined }, TestScalar, undefined);
    });

    it('invalid for undefined result', () => {
      const inputValue = { error: 'Some error message' };
      test(inputValue, TestScalar, undefined);
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
      test('FOO', TestEnum, 'InternalFoo');

      test('BAR', TestEnum, 123456789);
    });

    it('invalid for misspelled enum value', () => {
      test('foo', TestEnum, undefined);
    });

    it('invalid for incorrect value type', () => {
      test(123, TestEnum, undefined);
      test({ field: 'value' }, TestEnum, undefined);
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
      test({ foo: 123 }, TestInputObject, { foo: 123 });
    });

    it('invalid for a non-object type', () => {
      test(123, TestInputObject, undefined);
    });

    it('invalid for an invalid field', () => {
      test({ foo: NaN }, TestInputObject, undefined);
    });

    it('invalid for multiple invalid fields', () => {
      test({ foo: 'abc', bar: 'def' }, TestInputObject, undefined);
    });

    it('invalid for a missing required field', () => {
      test({ bar: 123 }, TestInputObject, undefined);
    });

    it('invalid for an unknown field', () => {
      test({ foo: 123, unknownField: 123 }, TestInputObject, undefined);
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

    it('returns for valid input', () => {
      test({ foo: 123 }, TestInputObject, { foo: 123 });
    });

    it('invalid if more than one field is specified', () => {
      test({ foo: 123, bar: null }, TestInputObject, undefined);
    });

    it('invalid if the one field is null', () => {
      test({ bar: null }, TestInputObject, undefined);
    });

    it('invalid for an invalid field', () => {
      test({ foo: NaN }, TestInputObject, undefined);
    });

    it('invalid for an unknown field', () => {
      test({ foo: 123, unknownField: 123 }, TestInputObject, undefined);
    });
  });

  describe('for GraphQLInputObject with default value', () => {
    const makeTestInputObject = (defaultValue: unknown) =>
      new GraphQLInputObjectType({
        name: 'TestInputObject',
        fields: {
          foo: {
            type: new GraphQLScalarType({ name: 'TestScalar' }),
            default: { value: defaultValue },
          },
        },
      });

    it('returns no errors for valid input value', () => {
      test({ foo: 5 }, makeTestInputObject(7), { foo: 5 });
    });

    it('returns object with default value', () => {
      test({}, makeTestInputObject(7), { foo: 7 });
    });

    it('returns null as value', () => {
      test({}, makeTestInputObject(null), { foo: null });
    });

    it('returns NaN as value', () => {
      expect(coerceInputValue({}, makeTestInputObject(NaN)))
        .to.have.property('foo')
        .that.satisfy(Number.isNaN);
    });
  });

  describe('for GraphQLList', () => {
    const TestList = new GraphQLList(GraphQLInt);

    it('returns no error for a valid input', () => {
      test([1, 2, 3], TestList, [1, 2, 3]);
    });

    it('returns no error for a valid iterable input', () => {
      function* listGenerator() {
        yield 1;
        yield 2;
        yield 3;
      }

      test(listGenerator(), TestList, [1, 2, 3]);
    });

    it('invalid for an invalid input', () => {
      test([1, 'b', true, 4], TestList, undefined);
    });

    it('returns a list for a non-list value', () => {
      test(42, TestList, [42]);
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

      test({ length: 100500 }, TestListOfObjects, [{ length: 100500 }]);
    });

    it('invalid for a non-list invalid value', () => {
      test('INVALID', TestList, undefined);
    });

    it('returns null for a null value', () => {
      test(null, TestList, null);
    });
  });

  describe('for nested GraphQLList', () => {
    const TestNestedList = new GraphQLList(new GraphQLList(GraphQLInt));

    it('returns no error for a valid input', () => {
      test([[1], [2, 3]], TestNestedList, [[1], [2, 3]]);
    });

    it('returns a list for a non-list value', () => {
      test(42, TestNestedList, [[42]]);
    });

    it('returns null for a null value', () => {
      test(null, TestNestedList, null);
    });

    it('returns nested lists for nested non-list values', () => {
      test([1, 2, 3], TestNestedList, [[1], [2], [3]]);
    });

    it('returns nested null for nested null values', () => {
      test([42, [null], null], TestNestedList, [[42], [null], null]);
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
    const value = coerceInputLiteral(ast, type, variableValues);
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
      parser.parseVariableDefinitions() ?? [],
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

  it('convert using coerceInputLiteral from a custom scalar type', () => {
    const passthroughScalar = new GraphQLScalarType({
      name: 'PassthroughScalar',
      coerceInputLiteral(node) {
        invariant(node.kind === 'StringValue');
        return node.value;
      },
      coerceInputValue: identityFunc,
    });

    test('"value"', passthroughScalar, 'value');

    const printScalar = new GraphQLScalarType({
      name: 'PrintScalar',
      coerceInputLiteral(node) {
        return `~~~${print(node)}~~~`;
      },
      coerceInputValue: identityFunc,
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
      coerceInputLiteral() {
        throw new Error('Test');
      },
      coerceInputValue: identityFunc,
    });

    test('value', throwScalar, undefined);

    const returnUndefinedScalar = new GraphQLScalarType({
      name: 'ReturnUndefinedScalar',
      coerceInputLiteral() {
        return undefined;
      },
      coerceInputValue: identityFunc,
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
        int: { type: GraphQLInt, default: { value: 42 } },
        float: {
          type: GraphQLFloat,
          default: { literal: { kind: Kind.FLOAT, value: '3.14' } },
        },
      },
    });

    test('{}', type, { int: 42, float: 3.14 });
  });

  const testInputObj = new GraphQLInputObjectType({
    name: 'TestInput',
    fields: {
      int: { type: GraphQLInt, default: { value: 42 } },
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
      '',
      {},
      '{ requiredBool: $foo }',
      testInputObj,
      undefined,
    );
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
    const coerceInputValueCalls: any = [];

    const spyScalar = new GraphQLScalarType({
      name: 'SpyScalar',
      coerceInputValue(value) {
        coerceInputValueCalls.push(value);
        return value;
      },
    });

    const inputDefault = {
      literal: { kind: Kind.STRING, value: 'hello' },
    } as const;

    const inputValue = {
      default: inputDefault,
      type: spyScalar,
    };

    expect(coerceDefaultValue(inputValue)).to.equal('hello');

    // Call a second time
    expect(coerceDefaultValue(inputValue)).to.equal('hello');
    expect(coerceInputValueCalls).to.deep.equal(['hello']);
  });
});
