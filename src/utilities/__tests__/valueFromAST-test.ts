import { expect } from 'chai';
import { describe, it } from 'mocha';

import { identityFunc } from '../../jsutils/identityFunc';
import { invariant } from '../../jsutils/invariant';
import type { ObjMap } from '../../jsutils/ObjMap';

import { parseValue } from '../../language/parser';

import type { GraphQLInputType } from '../../type/definition';
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
} from '../../type/definition';
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
} from '../../type/scalars';

import { valueFromAST } from '../valueFromAST';

describe('valueFromAST', () => {
  function expectValueFrom(
    valueText: string,
    type: GraphQLInputType,
    variables?: ObjMap<unknown>,
  ) {
    const ast = parseValue(valueText);
    const value = valueFromAST(ast, type, variables);
    return expect(value);
  }

  it('rejects empty input', () => {
    expect(valueFromAST(null, GraphQLBoolean)).to.deep.equal(undefined);
  });

  it('converts according to input coercion rules', () => {
    expectValueFrom('true', GraphQLBoolean).to.equal(true);
    expectValueFrom('false', GraphQLBoolean).to.equal(false);
    expectValueFrom('123', GraphQLInt).to.equal(123);
    expectValueFrom('123', GraphQLFloat).to.equal(123);
    expectValueFrom('123.456', GraphQLFloat).to.equal(123.456);
    expectValueFrom('"abc123"', GraphQLString).to.equal('abc123');
    expectValueFrom('123456', GraphQLID).to.equal('123456');
    expectValueFrom('"123456"', GraphQLID).to.equal('123456');
  });

  it('does not convert when input coercion rules reject a value', () => {
    expectValueFrom('123', GraphQLBoolean).to.equal(undefined);
    expectValueFrom('123.456', GraphQLInt).to.equal(undefined);
    expectValueFrom('true', GraphQLInt).to.equal(undefined);
    expectValueFrom('"123"', GraphQLInt).to.equal(undefined);
    expectValueFrom('"123"', GraphQLFloat).to.equal(undefined);
    expectValueFrom('123', GraphQLString).to.equal(undefined);
    expectValueFrom('true', GraphQLString).to.equal(undefined);
    expectValueFrom('123.456', GraphQLString).to.equal(undefined);
  });

  it('convert using parseLiteral from a custom scalar type', () => {
    const passthroughScalar = new GraphQLScalarType({
      name: 'PassthroughScalar',
      parseLiteral(node) {
        invariant(node.kind === 'StringValue');
        return node.value;
      },
      parseValue: identityFunc,
    });

    expectValueFrom('"value"', passthroughScalar).to.equal('value');

    const throwScalar = new GraphQLScalarType({
      name: 'ThrowScalar',
      parseLiteral() {
        throw new Error('Test');
      },
      parseValue: identityFunc,
    });

    expectValueFrom('value', throwScalar).to.equal(undefined);

    const returnUndefinedScalar = new GraphQLScalarType({
      name: 'ReturnUndefinedScalar',
      parseLiteral() {
        return undefined;
      },
      parseValue: identityFunc,
    });

    expectValueFrom('value', returnUndefinedScalar).to.equal(undefined);
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

    expectValueFrom('RED', testEnum).to.equal(1);
    expectValueFrom('BLUE', testEnum).to.equal(3);
    expectValueFrom('3', testEnum).to.equal(undefined);
    expectValueFrom('"BLUE"', testEnum).to.equal(undefined);
    expectValueFrom('null', testEnum).to.equal(null);
    expectValueFrom('NULL', testEnum).to.equal(null);
    expectValueFrom('NULL', new GraphQLNonNull(testEnum)).to.equal(null);
    expectValueFrom('NAN', testEnum).to.deep.equal(NaN);
    expectValueFrom('NO_CUSTOM_VALUE', testEnum).to.equal('NO_CUSTOM_VALUE');
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
    expectValueFrom('null', GraphQLBoolean).to.equal(null);
    expectValueFrom('null', nonNullBool).to.equal(undefined);
  });

  it('coerces lists of values', () => {
    expectValueFrom('true', listOfBool).to.deep.equal([true]);
    expectValueFrom('123', listOfBool).to.equal(undefined);
    expectValueFrom('null', listOfBool).to.equal(null);
    expectValueFrom('[true, false]', listOfBool).to.deep.equal([true, false]);
    expectValueFrom('[true, 123]', listOfBool).to.equal(undefined);
    expectValueFrom('[true, null]', listOfBool).to.deep.equal([true, null]);
    expectValueFrom('{ true: true }', listOfBool).to.equal(undefined);
  });

  it('coerces non-null lists of values', () => {
    expectValueFrom('true', nonNullListOfBool).to.deep.equal([true]);
    expectValueFrom('123', nonNullListOfBool).to.equal(undefined);
    expectValueFrom('null', nonNullListOfBool).to.equal(undefined);
    expectValueFrom('[true, false]', nonNullListOfBool).to.deep.equal([
      true,
      false,
    ]);
    expectValueFrom('[true, 123]', nonNullListOfBool).to.equal(undefined);
    expectValueFrom('[true, null]', nonNullListOfBool).to.deep.equal([
      true,
      null,
    ]);
  });

  it('coerces lists of non-null values', () => {
    expectValueFrom('true', listOfNonNullBool).to.deep.equal([true]);
    expectValueFrom('123', listOfNonNullBool).to.equal(undefined);
    expectValueFrom('null', listOfNonNullBool).to.equal(null);
    expectValueFrom('[true, false]', listOfNonNullBool).to.deep.equal([
      true,
      false,
    ]);
    expectValueFrom('[true, 123]', listOfNonNullBool).to.equal(undefined);
    expectValueFrom('[true, null]', listOfNonNullBool).to.equal(undefined);
  });

  it('coerces non-null lists of non-null values', () => {
    expectValueFrom('true', nonNullListOfNonNullBool).to.deep.equal([true]);
    expectValueFrom('123', nonNullListOfNonNullBool).to.equal(undefined);
    expectValueFrom('null', nonNullListOfNonNullBool).to.equal(undefined);
    expectValueFrom('[true, false]', nonNullListOfNonNullBool).to.deep.equal([
      true,
      false,
    ]);
    expectValueFrom('[true, 123]', nonNullListOfNonNullBool).to.equal(
      undefined,
    );
    expectValueFrom('[true, null]', nonNullListOfNonNullBool).to.equal(
      undefined,
    );
  });

  const testInputObj = new GraphQLInputObjectType({
    name: 'TestInput',
    fields: {
      int: { type: GraphQLInt, defaultValue: 42 },
      bool: { type: GraphQLBoolean },
      requiredBool: { type: nonNullBool },
    },
  });

  it('coerces input objects according to input coercion rules', () => {
    expectValueFrom('null', testInputObj).to.equal(null);
    expectValueFrom('123', testInputObj).to.equal(undefined);
    expectValueFrom('[]', testInputObj).to.equal(undefined);
    expectValueFrom(
      '{ int: 123, requiredBool: false }',
      testInputObj,
    ).to.deep.equal({
      int: 123,
      requiredBool: false,
    });
    expectValueFrom(
      '{ bool: true, requiredBool: false }',
      testInputObj,
    ).to.deep.equal({
      int: 42,
      bool: true,
      requiredBool: false,
    });
    expectValueFrom('{ int: true, requiredBool: true }', testInputObj).to.equal(
      undefined,
    );
    expectValueFrom('{ requiredBool: null }', testInputObj).to.equal(undefined);
    expectValueFrom('{ bool: true }', testInputObj).to.equal(undefined);
  });

  it('accepts variable values assuming already coerced', () => {
    expectValueFrom('$var', GraphQLBoolean, {}).to.equal(undefined);
    expectValueFrom('$var', GraphQLBoolean, { var: true }).to.equal(true);
    expectValueFrom('$var', GraphQLBoolean, { var: null }).to.equal(null);
    expectValueFrom('$var', nonNullBool, { var: null }).to.equal(undefined);
  });

  it('asserts variables are provided as items in lists', () => {
    expectValueFrom('[ $foo ]', listOfBool, {}).to.deep.equal([null]);
    expectValueFrom('[ $foo ]', listOfNonNullBool, {}).to.equal(undefined);
    expectValueFrom('[ $foo ]', listOfNonNullBool, {
      foo: true,
    }).to.deep.equal([true]);
    // Note: variables are expected to have already been coerced, so we
    // do not expect the singleton wrapping behavior for variables.
    expectValueFrom('$foo', listOfNonNullBool, { foo: true }).to.equal(true);
    expectValueFrom('$foo', listOfNonNullBool, { foo: [true] }).to.deep.equal([
      true,
    ]);
  });

  it('omits input object fields for unprovided variables', () => {
    expectValueFrom(
      '{ int: $foo, bool: $foo, requiredBool: true }',
      testInputObj,
      {},
    ).to.deep.equal({ int: 42, requiredBool: true });

    expectValueFrom('{ requiredBool: $foo }', testInputObj, {}).to.equal(
      undefined,
    );

    expectValueFrom('{ requiredBool: $foo }', testInputObj, {
      foo: true,
    }).to.deep.equal({
      int: 42,
      requiredBool: true,
    });
  });
});
