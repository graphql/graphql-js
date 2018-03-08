/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it } from 'mocha';
import { expectPassesRule, expectFailsRule } from './harness';
import {
  VariablesAreInputTypes,
  nonInputTypeOnVarMessage,
} from '../rules/VariablesAreInputTypes';

describe('Validate: Variables are input types', () => {
  it('input types are valid', () => {
    expectPassesRule(
      VariablesAreInputTypes,
      `
      query Foo($a: String, $b: [Boolean!]!, $c: ComplexInput) {
        field(a: $a, b: $b, c: $c)
      }
    `,
    );
  });

  it('output types are invalid', () => {
    expectFailsRule(
      VariablesAreInputTypes,
      `
      query Foo($a: Dog, $b: [[CatOrDog!]]!, $c: Pet) {
        field(a: $a, b: $b, c: $c)
      }
    `,
      [
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
      ],
    );
  });
});
