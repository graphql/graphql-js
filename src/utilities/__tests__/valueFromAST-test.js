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
import { valueFromAST } from '../valueFromAST';
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLBoolean,
  GraphQLID,
  GraphQLNonNull,
} from '../../type';
import { parseValue } from '../../language';


describe('valueFromAST', () => {

  function testCase(type, valueText, expected) {
    expect(
      valueFromAST(parseValue(valueText), type)
    ).to.deep.equal(expected);
  }

  function testCaseWithVars(variables, type, valueText, expected) {
    expect(
      valueFromAST(parseValue(valueText), type, variables)
    ).to.deep.equal(expected);
  }

  it('rejects empty input', () => {
    expect(valueFromAST(null, GraphQLBoolean)).to.deep.equal(undefined);
  });

  it('converts according to input coercion rules', () => {
    testCase(GraphQLBoolean, 'true', true);
    testCase(GraphQLBoolean, 'false', false);
    testCase(GraphQLInt, '123', 123);
    testCase(GraphQLFloat, '123', 123);
    testCase(GraphQLFloat, '123.456', 123.456);
    testCase(GraphQLString, '"abc123"', 'abc123');
    testCase(GraphQLID, '123456', '123456');
    testCase(GraphQLID, '"123456"', '123456');
  });

  it('does not convert when input coercion rules reject a value', () => {
    testCase(GraphQLBoolean, '123', undefined);
    testCase(GraphQLInt, '123.456', undefined);
    testCase(GraphQLInt, 'true', undefined);
    testCase(GraphQLInt, '"123"', undefined);
    testCase(GraphQLFloat, '"123"', undefined);
    testCase(GraphQLString, '123', undefined);
    testCase(GraphQLString, 'true', undefined);
    testCase(GraphQLID, '123.456', undefined);
  });

  const testEnum = new GraphQLEnumType({
    name: 'TestColor',
    values: {
      RED: { value: 1 },
      GREEN: { value: 2 },
      BLUE: { value: 3 },
      NULL: { value: null },
      UNDEFINED: { value: undefined }
    }
  });

  it('converts enum values according to input coercion rules', () => {
    testCase(testEnum, 'RED', 1);
    testCase(testEnum, 'BLUE', 3);
    testCase(testEnum, '3', undefined);
    testCase(testEnum, '"BLUE"', undefined);
    testCase(testEnum, 'null', null);
    testCase(testEnum, 'NULL', null);
    testCase(testEnum, 'UNDEFINED', undefined);
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
    testCase(GraphQLBoolean, 'null', null);
    testCase(nonNullBool, 'null', undefined);
  });

  it('coerces lists of values', () => {
    testCase(listOfBool, 'true', [ true ]);
    testCase(listOfBool, '123', undefined);
    testCase(listOfBool, 'null', null);
    testCase(listOfBool, '[true, false]', [ true, false ]);
    testCase(listOfBool, '[true, 123]', undefined);
    testCase(listOfBool, '[true, null]', [ true, null ]);
    testCase(listOfBool, '{ true: true }', undefined);
  });

  it('coerces non-null lists of values', () => {
    testCase(nonNullListOfBool, 'true', [ true ]);
    testCase(nonNullListOfBool, '123', undefined);
    testCase(nonNullListOfBool, 'null', undefined);
    testCase(nonNullListOfBool, '[true, false]', [ true, false ]);
    testCase(nonNullListOfBool, '[true, 123]', undefined);
    testCase(nonNullListOfBool, '[true, null]', [ true, null ]);
  });

  it('coerces lists of non-null values', () => {
    testCase(listOfNonNullBool, 'true', [ true ]);
    testCase(listOfNonNullBool, '123', undefined);
    testCase(listOfNonNullBool, 'null', null);
    testCase(listOfNonNullBool, '[true, false]', [ true, false ]);
    testCase(listOfNonNullBool, '[true, 123]', undefined);
    testCase(listOfNonNullBool, '[true, null]', undefined);
  });

  it('coerces non-null lists of non-null values', () => {
    testCase(nonNullListOfNonNullBool, 'true', [ true ]);
    testCase(nonNullListOfNonNullBool, '123', undefined);
    testCase(nonNullListOfNonNullBool, 'null', undefined);
    testCase(nonNullListOfNonNullBool, '[true, false]', [ true, false ]);
    testCase(nonNullListOfNonNullBool, '[true, 123]', undefined);
    testCase(nonNullListOfNonNullBool, '[true, null]', undefined);
  });

  const testInputObj = new GraphQLInputObjectType({
    name: 'TestInput',
    fields: {
      int: { type: GraphQLInt, defaultValue: 42 },
      bool: { type: GraphQLBoolean },
      requiredBool: { type: nonNullBool },
    }
  });

  it('coerces input objects according to input coercion rules', () => {
    testCase(testInputObj, 'null', null);
    testCase(testInputObj, '123', undefined);
    testCase(testInputObj, '[]', undefined);
    testCase(
      testInputObj,
      '{ int: 123, requiredBool: false }',
      { int: 123, requiredBool: false }
    );
    testCase(
      testInputObj,
      '{ bool: true, requiredBool: false }',
      { int: 42, bool: true, requiredBool: false }
    );
    testCase(testInputObj, '{ int: true, requiredBool: true }', undefined);
    testCase(testInputObj, '{ requiredBool: null }', undefined);
    testCase(testInputObj, '{ bool: true }', undefined);
  });

  it('accepts variable values assuming already coerced', () => {
    testCaseWithVars({}, GraphQLBoolean, '$var', undefined);
    testCaseWithVars({ var: true }, GraphQLBoolean, '$var', true);
    testCaseWithVars({ var: null }, GraphQLBoolean, '$var', null);
  });

  it('asserts variables are provided as items in lists', () => {
    testCaseWithVars({}, listOfBool, '[ $foo ]', [ null ]);
    testCaseWithVars({}, listOfNonNullBool, '[ $foo ]', undefined);
    testCaseWithVars({ foo: true }, listOfNonNullBool, '[ $foo ]', [ true ]);
    // Note: variables are expected to have already been coerced, so we
    // do not expect the singleton wrapping behavior for variables.
    testCaseWithVars({ foo: true }, listOfNonNullBool, '$foo', true);
    testCaseWithVars({ foo: [ true ] }, listOfNonNullBool, '$foo', [ true ]);
  });

  it('omits input object fields for unprovided variables', () => {
    testCaseWithVars(
      {},
      testInputObj,
      '{ int: $foo, bool: $foo, requiredBool: true }',
      { int: 42, requiredBool: true }
    );
    testCaseWithVars(
      {},
      testInputObj,
      '{ requiredBool: $foo }',
      undefined
    );
    testCaseWithVars(
      { foo: true },
      testInputObj,
      '{ requiredBool: $foo }',
      { int: 42, requiredBool: true }
    );
  });

});
