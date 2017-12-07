/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it } from 'mocha';
import { expectPassesRule, expectFailsRule } from './harness';
import {
  VariablesDefaultValueAllowed,
  defaultForRequiredVarMessage,
} from '../rules/VariablesDefaultValueAllowed';

function defaultForRequiredVar(varName, typeName, guessTypeName, line, column) {
  return {
    message: defaultForRequiredVarMessage(varName, typeName, guessTypeName),
    locations: [{ line, column }],
    path: undefined,
  };
}

describe('Validate: Variable default value is allowed', () => {
  it('variables with no default values', () => {
    expectPassesRule(
      VariablesDefaultValueAllowed,
      `
      query NullableValues($a: Int, $b: String, $c: ComplexInput) {
        dog { name }
      }
    `,
    );
  });

  it('required variables without default values', () => {
    expectPassesRule(
      VariablesDefaultValueAllowed,
      `
      query RequiredValues($a: Int!, $b: String!) {
        dog { name }
      }
    `,
    );
  });

  it('variables with valid default values', () => {
    expectPassesRule(
      VariablesDefaultValueAllowed,
      `
      query WithDefaultValues(
        $a: Int = 1,
        $b: String = "ok",
        $c: ComplexInput = { requiredField: true, intField: 3 }
      ) {
        dog { name }
      }
    `,
    );
  });

  it('variables with valid default null values', () => {
    expectPassesRule(
      VariablesDefaultValueAllowed,
      `
      query WithDefaultValues(
        $a: Int = null,
        $b: String = null,
        $c: ComplexInput = { requiredField: true, intField: null }
      ) {
        dog { name }
      }
    `,
    );
  });

  it('no required variables with default values', () => {
    expectFailsRule(
      VariablesDefaultValueAllowed,
      `
      query UnreachableDefaultValues($a: Int! = 3, $b: String! = "default") {
        dog { name }
      }
    `,
      [
        defaultForRequiredVar('a', 'Int!', 'Int', 2, 49),
        defaultForRequiredVar('b', 'String!', 'String', 2, 66),
      ],
    );
  });

  it('variables with invalid default null values', () => {
    expectFailsRule(
      VariablesDefaultValueAllowed,
      `
      query WithDefaultValues($a: Int! = null, $b: String! = null) {
        dog { name }
      }
    `,
      [
        defaultForRequiredVar('a', 'Int!', 'Int', 2, 42),
        defaultForRequiredVar('b', 'String!', 'String', 2, 62),
      ],
    );
  });
});
