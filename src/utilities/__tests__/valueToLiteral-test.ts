import { expect } from 'chai';
import { describe, it } from 'mocha';

import { Kind } from '../../language/kinds.js';
import { parseConstValue } from '../../language/parser.js';

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

import {
  defaultScalarValueToLiteral,
  valueToLiteral,
} from '../valueToLiteral.js';

describe('valueToLiteral', () => {
  function test(
    value: unknown,
    type: GraphQLInputType,
    expected: string | undefined,
  ) {
    return expect(valueToLiteral(value, type)).to.deep.equal(
      expected == null
        ? undefined
        : parseConstValue(expected, { noLocation: true }),
    );
  }

  it('converts null values to Null AST', () => {
    test(null, GraphQLString, 'null');
    test(undefined, GraphQLString, 'null');
    test(null, new GraphQLNonNull(GraphQLString), undefined);
  });

  it('converts boolean values to Boolean ASTs', () => {
    test(true, GraphQLBoolean, 'true');
    test(false, GraphQLBoolean, 'false');
    test('false', GraphQLBoolean, undefined);
  });

  it('converts int number values to Int ASTs', () => {
    test(0, GraphQLInt, '0');
    test(-1, GraphQLInt, '-1');
    test(2147483647, GraphQLInt, '2147483647');
    test(2147483648, GraphQLInt, undefined);
    test(0.5, GraphQLInt, undefined);
  });

  it('converts float number values to Float ASTs', () => {
    test(123.5, GraphQLFloat, '123.5');
    test(2e40, GraphQLFloat, '2e+40');
    test(1099511627776, GraphQLFloat, '1099511627776');
    test('0.5', GraphQLFloat, undefined);
    // Non-finite
    test(NaN, GraphQLFloat, undefined);
    test(Infinity, GraphQLFloat, undefined);
  });

  it('converts String ASTs to String values', () => {
    test('hello world', GraphQLString, '"hello world"');
    test(123, GraphQLString, undefined);
  });

  it('converts ID values to Int/String ASTs', () => {
    test('hello world', GraphQLID, '"hello world"');
    test('123', GraphQLID, '123');
    test(123, GraphQLID, '123');
    test(
      '123456789123456789123456789123456789',
      GraphQLID,
      '123456789123456789123456789123456789',
    );
    test(123.5, GraphQLID, undefined);
  });

  const myEnum = new GraphQLEnumType({
    name: 'MyEnum',
    values: {
      HELLO: {},
      COMPLEX: { value: { someArbitrary: 'complexValue' } },
    },
  });

  it('converts Enum names to Enum ASTs', () => {
    test('HELLO', myEnum, 'HELLO');
    test('COMPLEX', myEnum, 'COMPLEX');
    // Undefined Enum
    test('GOODBYE', myEnum, undefined);
    test(123, myEnum, undefined);
  });

  it('converts List ASTs to array values', () => {
    test(['FOO', 'BAR'], new GraphQLList(GraphQLString), '["FOO", "BAR"]');
    test(['123', 123], new GraphQLList(GraphQLID), '[123, 123]');
    // Invalid items create an invalid result
    test(['FOO', 123], new GraphQLList(GraphQLString), undefined);
    // Does not coerce items to list singletons
    test('FOO', new GraphQLList(GraphQLString), '"FOO"');
  });

  const inputObj = new GraphQLInputObjectType({
    name: 'MyInputObj',
    fields: {
      foo: { type: new GraphQLNonNull(GraphQLFloat) },
      bar: { type: GraphQLID },
    },
  });

  it('converts input objects', () => {
    test({ foo: 3, bar: '3' }, inputObj, '{ foo: 3, bar: 3 }');
    test({ foo: 3 }, inputObj, '{ foo: 3 }');

    // Non-object is invalid
    test('123', inputObj, undefined);

    // Invalid fields create an invalid result
    test({ foo: '3' }, inputObj, undefined);

    // Missing required fields create an invalid result
    test({ bar: 3 }, inputObj, undefined);

    // Additional fields create an invalid result
    test({ foo: 3, unknown: 3 }, inputObj, undefined);
  });

  it('custom scalar types may define valueToLiteral', () => {
    const customScalar = new GraphQLScalarType({
      name: 'CustomScalar',
      valueToLiteral(value) {
        if (typeof value === 'string' && value.startsWith('#')) {
          return { kind: Kind.ENUM, value: value.slice(1) };
        }
      },
    });

    test('#FOO', customScalar, 'FOO');
    test('FOO', customScalar, undefined);
  });

  it('custom scalar types may throw errors from valueToLiteral', () => {
    const customScalar = new GraphQLScalarType({
      name: 'CustomScalar',
      valueToLiteral() {
        throw new Error();
      },
    });

    test('FOO', customScalar, undefined);
  });

  it('custom scalar types may fall back on default valueToLiteral', () => {
    const customScalar = new GraphQLScalarType({
      name: 'CustomScalar',
    });

    test({ foo: 'bar' }, customScalar, '{ foo: "bar" }');
  });

  describe('defaultScalarValueToLiteral', () => {
    function testDefault(value: unknown, expected: string) {
      return expect(defaultScalarValueToLiteral(value)).to.deep.equal(
        parseConstValue(expected, { noLocation: true }),
      );
    }

    it('converts null values to Null ASTs', () => {
      testDefault(null, 'null');
      testDefault(undefined, 'null');
    });

    it('converts boolean values to Boolean ASTs', () => {
      testDefault(true, 'true');
      testDefault(false, 'false');
    });

    it('converts number values to Int/Float ASTs', () => {
      testDefault(0, '0');
      testDefault(-1, '-1');
      testDefault(1099511627776, '1099511627776');
      testDefault(123.5, '123.5');
      testDefault(2e40, '2e+40');
    });

    it('converts non-finite number values to Null ASTs', () => {
      testDefault(NaN, 'null');
      testDefault(Infinity, 'null');
    });

    it('converts String values to String ASTs', () => {
      testDefault('hello world', '"hello world"');
    });

    it('converts array values to List ASTs', () => {
      testDefault(['abc', 123], '["abc", 123]');
    });

    it('converts object values to Object ASTs', () => {
      testDefault(
        { foo: 'abc', bar: null, baz: undefined },
        '{ foo: "abc", bar: null }',
      );
    });

    it('throws on values it cannot convert', () => {
      expect(() => defaultScalarValueToLiteral(Symbol())).to.throw(
        'Cannot convert value to AST: Symbol().',
      );
    });
  });
});
