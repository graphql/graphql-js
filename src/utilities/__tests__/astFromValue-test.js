/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { astFromValue } from '../astFromValue';
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLFloat,
} from '../../type';


describe('astFromValue', () => {

  it('converts boolean values to ASTs', () => {
    expect(astFromValue(true)).to.deep.equal(
      { kind: 'BooleanValue', value: true }
    );

    expect(astFromValue(false)).to.deep.equal(
      { kind: 'BooleanValue', value: false }
    );
  });

  it('converts numeric values to ASTs', () => {
    expect(astFromValue(123)).to.deep.equal(
      { kind: 'IntValue', value: '123' }
    );

    expect(astFromValue(123.0)).to.deep.equal(
      { kind: 'IntValue', value: '123' }
    );

    expect(astFromValue(123.5)).to.deep.equal(
      { kind: 'FloatValue', value: '123.5' }
    );

    expect(astFromValue(1e4)).to.deep.equal(
      { kind: 'IntValue', value: '10000' }
    );

    expect(astFromValue(1e40)).to.deep.equal(
      { kind: 'FloatValue', value: '1e+40' }
    );
  });

  it('converts numeric values to Float ASTs', () => {
    expect(astFromValue(123, GraphQLFloat)).to.deep.equal(
      { kind: 'FloatValue', value: '123.0' }
    );

    expect(astFromValue(123.0, GraphQLFloat)).to.deep.equal(
      { kind: 'FloatValue', value: '123.0' }
    );

    expect(astFromValue(123.5, GraphQLFloat)).to.deep.equal(
      { kind: 'FloatValue', value: '123.5' }
    );

    expect(astFromValue(1e4, GraphQLFloat)).to.deep.equal(
      { kind: 'FloatValue', value: '10000.0' }
    );

    expect(astFromValue(1e40, GraphQLFloat)).to.deep.equal(
      { kind: 'FloatValue', value: '1e+40' }
    );
  });

  it('converts string values to ASTs', () => {
    expect(astFromValue('hello')).to.deep.equal(
      { kind: 'StringValue', value: 'hello' }
    );

    expect(astFromValue('VALUE')).to.deep.equal(
      { kind: 'StringValue', value: 'VALUE' }
    );

    expect(astFromValue('VA\nLUE')).to.deep.equal(
      { kind: 'StringValue', value: 'VA\\nLUE' }
    );

    expect(astFromValue('123')).to.deep.equal(
      { kind: 'StringValue', value: '123' }
    );
  });

  const myEnum = new GraphQLEnumType({
    name: 'MyEnum',
    values: {
      HELLO: {},
      GOODBYE: {},
    }
  });

  it('converts string values to Enum ASTs if possible', () => {
    expect(astFromValue('hello', myEnum)).to.deep.equal(
      { kind: 'EnumValue', value: 'hello' }
    );

    expect(astFromValue('HELLO', myEnum)).to.deep.equal(
      { kind: 'EnumValue', value: 'HELLO' }
    );

    expect(astFromValue('VALUE', myEnum)).to.deep.equal(
      { kind: 'EnumValue', value: 'VALUE' }
    );

    expect(astFromValue('VA\nLUE', myEnum)).to.deep.equal(
      { kind: 'StringValue', value: 'VA\\nLUE' }
    );

    expect(astFromValue('123', myEnum)).to.deep.equal(
      { kind: 'StringValue', value: '123' }
    );
  });

  it('converts array values to List ASTs', () => {
    expect(astFromValue([ 'FOO', 'BAR' ])).to.deep.equal(
      { kind: 'ListValue',
        values: [
          { kind: 'StringValue', value: 'FOO' },
          { kind: 'StringValue', value: 'BAR' } ] }
    );

    expect(
      astFromValue([ 'FOO', 'BAR' ],
      new GraphQLList(myEnum))
    ).to.deep.equal(
      { kind: 'ListValue',
        values: [
          { kind: 'EnumValue', value: 'FOO' },
          { kind: 'EnumValue', value: 'BAR' } ] }
    );
  });

  it('converts list singletons', () => {
    expect(astFromValue(
      'FOO',
      new GraphQLList(myEnum)
    )).to.deep.equal(
      { kind: 'EnumValue', value: 'FOO' }
    );
  });

  it('converts input objects', () => {
    expect(astFromValue({ foo: 3, bar: 'HELLO' })).to.deep.equal(
      { kind: 'ObjectValue',
        fields: [
          { kind: 'ObjectField',
            name: { kind: 'Name', value: 'foo' },
            value: { kind: 'IntValue', value: '3' } },
          { kind: 'ObjectField',
            name: { kind: 'Name', value: 'bar' },
            value: { kind: 'StringValue', value: 'HELLO' } } ] }
    );

    const inputObj = new GraphQLInputObjectType({
      name: 'MyInputObj',
      fields: {
        foo: { type: GraphQLFloat },
        bar: { type: myEnum }
      }
    });

    expect(astFromValue(
      { foo: 3, bar: 'HELLO' },
      inputObj
    )).to.deep.equal(
      { kind: 'ObjectValue',
        fields: [
          { kind: 'ObjectField',
            name: { kind: 'Name', value: 'foo' },
            value: { kind: 'FloatValue', value: '3.0' } },
          { kind: 'ObjectField',
            name: { kind: 'Name', value: 'bar' },
            value: { kind: 'EnumValue', value: 'HELLO' } } ] }
    );
  });
});
