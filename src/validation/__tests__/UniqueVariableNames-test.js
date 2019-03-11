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
  UniqueVariableNames,
  duplicateVariableMessage,
} from '../rules/UniqueVariableNames';

function expectErrors(queryStr) {
  return expectValidationErrors(UniqueVariableNames, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

function duplicateVariable(name, l1, c1, l2, c2) {
  return {
    message: duplicateVariableMessage(name),
    locations: [{ line: l1, column: c1 }, { line: l2, column: c2 }],
  };
}

describe('Validate: Unique variable names', () => {
  it('unique variable names', () => {
    expectValid(`
      query A($x: Int, $y: String) { __typename }
      query B($x: String, $y: Int) { __typename }
    `);
  });

  it('duplicate variable names', () => {
    expectErrors(`
      query A($x: Int, $x: Int, $x: String) { __typename }
      query B($x: String, $x: Int) { __typename }
      query C($x: Int, $x: Int) { __typename }
    `).to.deep.equal([
      duplicateVariable('x', 2, 16, 2, 25),
      duplicateVariable('x', 2, 16, 2, 34),
      duplicateVariable('x', 3, 16, 3, 28),
      duplicateVariable('x', 4, 16, 4, 25),
    ]);
  });
});
