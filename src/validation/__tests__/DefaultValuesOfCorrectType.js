/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { describe, it } from 'mocha';
import { expectPassesRule, expectFailsRule } from './harness';
import {
  DefaultValuesOfCorrectType,
  defaultForNonNullArgMessage,
  badValueForDefaultArgMessage,
} from '../rules/DefaultValuesOfCorrectType';


function defaultForNonNullArg(varName, typeName, guessTypeName, line, column) {
  return {
    message: defaultForNonNullArgMessage(varName, typeName, guessTypeName),
    locations: [ { line, column } ],
  };
}

function badValue(varName, typeName, val, line, column, errors) {
  let realErrors;
  if (!errors) {
    realErrors = [
      `Expected type "${typeName}", found ${val}.`
    ];
  } else {
    realErrors = errors;
  }
  return {
    message: badValueForDefaultArgMessage(varName, typeName, val, realErrors),
    locations: [ { line, column } ],
  };
}

describe('Validate: Variable default values of correct type', () => {

  it('variables with no default values', () => {
    expectPassesRule(DefaultValuesOfCorrectType, `
      query NullableValues($a: Int, $b: String, $c: ComplexInput) {
        dog { name }
      }
    `);
  });

  it('required variables without default values', () => {
    expectPassesRule(DefaultValuesOfCorrectType, `
      query RequiredValues($a: Int!, $b: String!) {
        dog { name }
      }
    `);
  });

  it('variables with valid default values', () => {
    expectPassesRule(DefaultValuesOfCorrectType, `
      query WithDefaultValues(
        $a: Int = 1,
        $b: String = "ok",
        $c: ComplexInput = { requiredField: true, intField: 3 }
      ) {
        dog { name }
      }
    `);
  });

  it('no required variables with default values', () => {
    expectFailsRule(DefaultValuesOfCorrectType, `
      query UnreachableDefaultValues($a: Int! = 3, $b: String! = "default") {
        dog { name }
      }
    `, [
      defaultForNonNullArg('a', 'Int!', 'Int', 2, 49),
      defaultForNonNullArg('b', 'String!', 'String', 2, 66)
    ]);
  });

  it('variables with invalid default values', () => {
    expectFailsRule(DefaultValuesOfCorrectType, `
      query InvalidDefaultValues(
        $a: Int = "one",
        $b: String = 4,
        $c: ComplexInput = "notverycomplex"
      ) {
        dog { name }
      }
    `, [
      badValue('a', 'Int', '"one"', 3, 19, [
        'Expected type "Int", found "one".'
      ]),
      badValue('b', 'String', '4', 4, 22, [
        'Expected type "String", found 4.'
      ]),
      badValue('c', 'ComplexInput', '"notverycomplex"', 5, 28, [
        'Expected "ComplexInput", found not an object.'
      ])
    ]);
  });

  it('complex variables missing required field', () => {
    expectFailsRule(DefaultValuesOfCorrectType, `
      query MissingRequiredField($a: ComplexInput = {intField: 3}) {
        dog { name }
      }
    `, [
      badValue('a', 'ComplexInput', '{intField: 3}', 2, 53, [
        'In field "requiredField": Expected "Boolean!", found null.'
      ])
    ]);
  });

  it('list variables with invalid item', () => {
    expectFailsRule(DefaultValuesOfCorrectType, `
      query InvalidItem($a: [String] = ["one", 2]) {
        dog { name }
      }
    `, [
      badValue('a', '[String]', '["one", 2]', 2, 40, [
        'In element #1: Expected type "String", found 2.'
      ])
    ]);
  });

});
