import { expect } from 'chai';
import { describe, it } from 'mocha';

import { astFromValueUntyped } from '../astFromValueUntyped.js';

describe('astFromValue', () => {
  it('converts boolean values to ASTs', () => {
    expect(astFromValueUntyped(true)).to.deep.equal({
      kind: 'BooleanValue',
      value: true,
    });

    expect(astFromValueUntyped(false)).to.deep.equal({
      kind: 'BooleanValue',
      value: false,
    });
  });

  it('converts Int values to Int ASTs', () => {
    expect(astFromValueUntyped(-1)).to.deep.equal({
      kind: 'IntValue',
      value: '-1',
    });

    expect(astFromValueUntyped(123.0)).to.deep.equal({
      kind: 'IntValue',
      value: '123',
    });

    expect(astFromValueUntyped(1e4)).to.deep.equal({
      kind: 'IntValue',
      value: '10000',
    });
  });

  it('converts Float values to Int/Float ASTs', () => {
    expect(astFromValueUntyped(-1)).to.deep.equal({
      kind: 'IntValue',
      value: '-1',
    });

    expect(astFromValueUntyped(123.0)).to.deep.equal({
      kind: 'IntValue',
      value: '123',
    });

    expect(astFromValueUntyped(123.5)).to.deep.equal({
      kind: 'FloatValue',
      value: '123.5',
    });

    expect(astFromValueUntyped(1e4)).to.deep.equal({
      kind: 'IntValue',
      value: '10000',
    });

    expect(astFromValueUntyped(1e40)).to.deep.equal({
      kind: 'FloatValue',
      value: '1e+40',
    });
  });

  it('converts String values to String ASTs', () => {
    expect(astFromValueUntyped('hello')).to.deep.equal({
      kind: 'StringValue',
      value: 'hello',
    });

    expect(astFromValueUntyped('VALUE')).to.deep.equal({
      kind: 'StringValue',
      value: 'VALUE',
    });

    expect(astFromValueUntyped('VA\nLUE')).to.deep.equal({
      kind: 'StringValue',
      value: 'VA\nLUE',
    });

    expect(astFromValueUntyped(undefined)).to.deep.equal(null);
  });

  it('converts ID values to Int/String ASTs', () => {
    expect(astFromValueUntyped('hello')).to.deep.equal({
      kind: 'StringValue',
      value: 'hello',
    });

    expect(astFromValueUntyped('VALUE')).to.deep.equal({
      kind: 'StringValue',
      value: 'VALUE',
    });

    // Note: EnumValues cannot contain non-identifier characters
    expect(astFromValueUntyped('VA\nLUE')).to.deep.equal({
      kind: 'StringValue',
      value: 'VA\nLUE',
    });

    // Note: IntValues are used when possible.
    expect(astFromValueUntyped(-1)).to.deep.equal({
      kind: 'IntValue',
      value: '-1',
    });

    expect(astFromValueUntyped(123)).to.deep.equal({
      kind: 'IntValue',
      value: '123',
    });

    expect(astFromValueUntyped('01')).to.deep.equal({
      kind: 'StringValue',
      value: '01',
    });
  });

  it('converts array values to List ASTs', () => {
    expect(astFromValueUntyped(['FOO', 'BAR'])).to.deep.equal({
      kind: 'ListValue',
      values: [
        { kind: 'StringValue', value: 'FOO' },
        { kind: 'StringValue', value: 'BAR' },
      ],
    });

    function* listGenerator() {
      yield 1;
      yield 2;
      yield 3;
    }

    expect(astFromValueUntyped(listGenerator())).to.deep.equal({
      kind: 'ListValue',
      values: [
        { kind: 'IntValue', value: '1' },
        { kind: 'IntValue', value: '2' },
        { kind: 'IntValue', value: '3' },
      ],
    });
  });

  it('converts list singletons', () => {
    expect(astFromValueUntyped('FOO')).to.deep.equal({
      kind: 'StringValue',
      value: 'FOO',
    });
  });

  it('converts objects', () => {
    expect(astFromValueUntyped({ foo: 3, bar: 'HELLO' })).to.deep.equal({
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
          value: { kind: 'StringValue', value: 'HELLO' },
        },
      ],
    });
  });

  it('converts objects with explicit nulls', () => {
    expect(astFromValueUntyped({ foo: null })).to.deep.equal({
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
});
