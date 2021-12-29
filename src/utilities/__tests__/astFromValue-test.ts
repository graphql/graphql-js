import { expect } from 'chai';
import { describe, it } from 'mocha';

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

import { astFromValue } from '../astFromValue';

describe('astFromValue', () => {
  it('converts boolean values to ASTs', () => {
    expect(astFromValue(true, GraphQLBoolean)).to.deep.equal({
      kind: 'BooleanValue',
      value: true,
    });

    expect(astFromValue(false, GraphQLBoolean)).to.deep.equal({
      kind: 'BooleanValue',
      value: false,
    });

    expect(astFromValue(undefined, GraphQLBoolean)).to.deep.equal(null);

    expect(astFromValue(null, GraphQLBoolean)).to.deep.equal({
      kind: 'NullValue',
    });

    expect(astFromValue(0, GraphQLBoolean)).to.deep.equal({
      kind: 'BooleanValue',
      value: false,
    });

    expect(astFromValue(1, GraphQLBoolean)).to.deep.equal({
      kind: 'BooleanValue',
      value: true,
    });

    const NonNullBoolean = new GraphQLNonNull(GraphQLBoolean);
    expect(astFromValue(0, NonNullBoolean)).to.deep.equal({
      kind: 'BooleanValue',
      value: false,
    });
  });

  it('converts Int values to Int ASTs', () => {
    expect(astFromValue(-1, GraphQLInt)).to.deep.equal({
      kind: 'IntValue',
      value: '-1',
    });

    expect(astFromValue(123.0, GraphQLInt)).to.deep.equal({
      kind: 'IntValue',
      value: '123',
    });

    expect(astFromValue(1e4, GraphQLInt)).to.deep.equal({
      kind: 'IntValue',
      value: '10000',
    });

    // GraphQL spec does not allow coercing non-integer values to Int to avoid
    // accidental data loss.
    expect(() => astFromValue(123.5, GraphQLInt)).to.throw(
      'Int cannot represent non-integer value: 123.5',
    );

    // Note: outside the bounds of 32bit signed int.
    expect(() => astFromValue(1e40, GraphQLInt)).to.throw(
      'Int cannot represent non 32-bit signed integer value: 1e+40',
    );

    expect(() => astFromValue(NaN, GraphQLInt)).to.throw(
      'Int cannot represent non-integer value: NaN',
    );
  });

  it('converts Float values to Int/Float ASTs', () => {
    expect(astFromValue(-1, GraphQLFloat)).to.deep.equal({
      kind: 'IntValue',
      value: '-1',
    });

    expect(astFromValue(123.0, GraphQLFloat)).to.deep.equal({
      kind: 'IntValue',
      value: '123',
    });

    expect(astFromValue(123.5, GraphQLFloat)).to.deep.equal({
      kind: 'FloatValue',
      value: '123.5',
    });

    expect(astFromValue(1e4, GraphQLFloat)).to.deep.equal({
      kind: 'IntValue',
      value: '10000',
    });

    expect(astFromValue(1e40, GraphQLFloat)).to.deep.equal({
      kind: 'FloatValue',
      value: '1e+40',
    });
  });

  it('converts String values to String ASTs', () => {
    expect(astFromValue('hello', GraphQLString)).to.deep.equal({
      kind: 'StringValue',
      value: 'hello',
    });

    expect(astFromValue('VALUE', GraphQLString)).to.deep.equal({
      kind: 'StringValue',
      value: 'VALUE',
    });

    expect(astFromValue('VA\nLUE', GraphQLString)).to.deep.equal({
      kind: 'StringValue',
      value: 'VA\nLUE',
    });

    expect(astFromValue(123, GraphQLString)).to.deep.equal({
      kind: 'StringValue',
      value: '123',
    });

    expect(astFromValue(false, GraphQLString)).to.deep.equal({
      kind: 'StringValue',
      value: 'false',
    });

    expect(astFromValue(null, GraphQLString)).to.deep.equal({
      kind: 'NullValue',
    });

    expect(astFromValue(undefined, GraphQLString)).to.deep.equal(null);
  });

  it('converts ID values to Int/String ASTs', () => {
    expect(astFromValue('hello', GraphQLID)).to.deep.equal({
      kind: 'StringValue',
      value: 'hello',
    });

    expect(astFromValue('VALUE', GraphQLID)).to.deep.equal({
      kind: 'StringValue',
      value: 'VALUE',
    });

    // Note: EnumValues cannot contain non-identifier characters
    expect(astFromValue('VA\nLUE', GraphQLID)).to.deep.equal({
      kind: 'StringValue',
      value: 'VA\nLUE',
    });

    // Note: IntValues are used when possible.
    expect(astFromValue(-1, GraphQLID)).to.deep.equal({
      kind: 'IntValue',
      value: '-1',
    });

    expect(astFromValue(123, GraphQLID)).to.deep.equal({
      kind: 'IntValue',
      value: '123',
    });

    expect(astFromValue('123', GraphQLID)).to.deep.equal({
      kind: 'IntValue',
      value: '123',
    });

    expect(astFromValue('01', GraphQLID)).to.deep.equal({
      kind: 'StringValue',
      value: '01',
    });

    expect(() => astFromValue(false, GraphQLID)).to.throw(
      'ID cannot represent value: false',
    );

    expect(astFromValue(null, GraphQLID)).to.deep.equal({ kind: 'NullValue' });

    expect(astFromValue(undefined, GraphQLID)).to.deep.equal(null);
  });

  it('converts using serialize from a custom scalar type', () => {
    const passthroughScalar = new GraphQLScalarType({
      name: 'PassthroughScalar',
      serialize(value) {
        return value;
      },
    });

    expect(astFromValue('value', passthroughScalar)).to.deep.equal({
      kind: 'StringValue',
      value: 'value',
    });

    expect(() => astFromValue(NaN, passthroughScalar)).to.throw(
      'Cannot convert value to AST: NaN.',
    );
    expect(() => astFromValue(Infinity, passthroughScalar)).to.throw(
      'Cannot convert value to AST: Infinity.',
    );

    const returnNullScalar = new GraphQLScalarType({
      name: 'ReturnNullScalar',
      serialize() {
        return null;
      },
    });

    expect(astFromValue('value', returnNullScalar)).to.equal(null);

    class SomeClass {}

    const returnCustomClassScalar = new GraphQLScalarType({
      name: 'ReturnCustomClassScalar',
      serialize() {
        return new SomeClass();
      },
    });

    expect(() => astFromValue('value', returnCustomClassScalar)).to.throw(
      'Cannot convert value to AST: {}.',
    );
  });

  it('does not converts NonNull values to NullValue', () => {
    const NonNullBoolean = new GraphQLNonNull(GraphQLBoolean);
    expect(astFromValue(null, NonNullBoolean)).to.deep.equal(null);
  });

  const complexValue = { someArbitrary: 'complexValue' };

  const myEnum = new GraphQLEnumType({
    name: 'MyEnum',
    values: {
      HELLO: {},
      GOODBYE: {},
      COMPLEX: { value: complexValue },
    },
  });

  it('converts string values to Enum ASTs if possible', () => {
    expect(astFromValue('HELLO', myEnum)).to.deep.equal({
      kind: 'EnumValue',
      value: 'HELLO',
    });

    expect(astFromValue(complexValue, myEnum)).to.deep.equal({
      kind: 'EnumValue',
      value: 'COMPLEX',
    });

    // Note: case sensitive
    expect(() => astFromValue('hello', myEnum)).to.throw(
      'Enum "MyEnum" cannot represent value: "hello"',
    );

    // Note: Not a valid enum value
    expect(() => astFromValue('UNKNOWN_VALUE', myEnum)).to.throw(
      'Enum "MyEnum" cannot represent value: "UNKNOWN_VALUE"',
    );
  });

  it('converts array values to List ASTs', () => {
    expect(
      astFromValue(['FOO', 'BAR'], new GraphQLList(GraphQLString)),
    ).to.deep.equal({
      kind: 'ListValue',
      values: [
        { kind: 'StringValue', value: 'FOO' },
        { kind: 'StringValue', value: 'BAR' },
      ],
    });

    expect(
      astFromValue(['HELLO', 'GOODBYE'], new GraphQLList(myEnum)),
    ).to.deep.equal({
      kind: 'ListValue',
      values: [
        { kind: 'EnumValue', value: 'HELLO' },
        { kind: 'EnumValue', value: 'GOODBYE' },
      ],
    });

    function* listGenerator() {
      yield 1;
      yield 2;
      yield 3;
    }

    expect(
      astFromValue(listGenerator(), new GraphQLList(GraphQLInt)),
    ).to.deep.equal({
      kind: 'ListValue',
      values: [
        { kind: 'IntValue', value: '1' },
        { kind: 'IntValue', value: '2' },
        { kind: 'IntValue', value: '3' },
      ],
    });
  });

  it('converts list singletons', () => {
    expect(astFromValue('FOO', new GraphQLList(GraphQLString))).to.deep.equal({
      kind: 'StringValue',
      value: 'FOO',
    });
  });

  it('skip invalid list items', () => {
    const ast = astFromValue(
      ['FOO', null, 'BAR'],
      new GraphQLList(new GraphQLNonNull(GraphQLString)),
    );

    expect(ast).to.deep.equal({
      kind: 'ListValue',
      values: [
        { kind: 'StringValue', value: 'FOO' },
        { kind: 'StringValue', value: 'BAR' },
      ],
    });
  });

  const inputObj = new GraphQLInputObjectType({
    name: 'MyInputObj',
    fields: {
      foo: { type: GraphQLFloat },
      bar: { type: myEnum },
    },
  });

  it('converts input objects', () => {
    expect(astFromValue({ foo: 3, bar: 'HELLO' }, inputObj)).to.deep.equal({
      kind: 'ObjectValue',
      fields: [
        {
          kind: 'ObjectField',
          name: { kind: 'Name', value: 'foo' },
          value: { kind: 'IntValue', value: '3' },
        },
        {
          kind: 'ObjectField',
          name: { kind: 'Name', value: 'bar' },
          value: { kind: 'EnumValue', value: 'HELLO' },
        },
      ],
    });
  });

  it('converts input objects with explicit nulls', () => {
    expect(astFromValue({ foo: null }, inputObj)).to.deep.equal({
      kind: 'ObjectValue',
      fields: [
        {
          kind: 'ObjectField',
          name: { kind: 'Name', value: 'foo' },
          value: { kind: 'NullValue' },
        },
      ],
    });
  });

  it('does not converts non-object values as input objects', () => {
    expect(astFromValue(5, inputObj)).to.equal(null);
  });
});
