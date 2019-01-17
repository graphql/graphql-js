/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expectValidationErrors } from './harness';
import {
  VariablesAreInputTypes,
  nonInputTypeOnVarMessage,
} from '../rules/VariablesAreInputTypes';

function expectErrors(queryStr) {
  return expectValidationErrors(VariablesAreInputTypes, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

describe('Validate: Variables are input types', () => {
  it('input types are valid', () => {
    expectValid(`
      query Foo($a: String, $b: [Boolean!]!, $c: ComplexInput) {
        field(a: $a, b: $b, c: $c)
      }
    `);
  });

  it('output types are invalid', () => {
    expectErrors(`
      query Foo($a: Dog, $b: [[CatOrDog!]]!, $c: Pet) {
        field(a: $a, b: $b, c: $c)
      }
    `).to.deep.equal([
      {
        locations: [{ line: 2, column: 21 }],
        message: nonInputTypeOnVarMessage('a', 'Dog'),
      },
      {
        locations: [{ line: 2, column: 30 }],
        message: nonInputTypeOnVarMessage('b', '[[CatOrDog!]]!'),
      },
      {
        locations: [{ line: 2, column: 50 }],
        message: nonInputTypeOnVarMessage('c', 'Pet'),
      },
    ]);
  });
});
