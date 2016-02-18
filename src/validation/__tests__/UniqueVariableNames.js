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
  UniqueVariableNames,
  duplicateVariableMessage,
} from '../rules/UniqueVariableNames';


function duplicateVariable(name, l1, c1, l2, c2) {
  return {
    message: duplicateVariableMessage(name),
    locations: [ { line: l1, column: c1 }, { line: l2, column: c2 } ],
  };
}

describe('Validate: Unique variable names', () => {

  it('unique variable names', () => {
    expectPassesRule(UniqueVariableNames, `
      query A($x: Int, $y: String) { __typename }
      query B($x: String, $y: Int) { __typename }
    `);
  });

  it('duplicate variable names', () => {
    expectFailsRule(UniqueVariableNames, `
      query A($x: Int, $x: Int, $x: String) { __typename }
      query B($x: String, $x: Int) { __typename }
      query C($x: Int, $x: Int) { __typename }
    `, [
      duplicateVariable('x', 2, 16, 2, 25),
      duplicateVariable('x', 2, 16, 2, 34),
      duplicateVariable('x', 3, 16, 3, 28),
      duplicateVariable('x', 4, 16, 4, 25)
    ]);
  });

});
