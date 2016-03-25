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
  UniqueArgumentNames,
  duplicateArgMessage,
} from '../rules/UniqueArgumentNames';


function duplicateArg(argName, l1, c1, l2, c2) {
  return {
    message: duplicateArgMessage(argName),
    locations: [ { line: l1, column: c1 }, { line: l2, column: c2 } ],
  };
}

describe('Validate: Unique argument names', () => {

  it('no arguments on field', () => {
    expectPassesRule(UniqueArgumentNames, `
      {
        field
      }
    `);
  });

  it('no arguments on directive', () => {
    expectPassesRule(UniqueArgumentNames, `
      {
        field @directive
      }
    `);
  });

  it('argument on field', () => {
    expectPassesRule(UniqueArgumentNames, `
      {
        field(arg: "value")
      }
    `);
  });

  it('argument on directive', () => {
    expectPassesRule(UniqueArgumentNames, `
      {
        field @directive(arg: "value")
      }
    `);
  });

  it('same argument on two fields', () => {
    expectPassesRule(UniqueArgumentNames, `
      {
        one: field(arg: "value")
        two: field(arg: "value")
      }
    `);
  });

  it('same argument on field and directive', () => {
    expectPassesRule(UniqueArgumentNames, `
      {
        field(arg: "value") @directive(arg: "value")
      }
    `);
  });

  it('same argument on two directives', () => {
    expectPassesRule(UniqueArgumentNames, `
      {
        field @directive1(arg: "value") @directive2(arg: "value")
      }
    `);
  });

  it('multiple field arguments', () => {
    expectPassesRule(UniqueArgumentNames, `
      {
        field(arg1: "value", arg2: "value", arg3: "value")
      }
    `);
  });

  it('multiple directive arguments', () => {
    expectPassesRule(UniqueArgumentNames, `
      {
        field @directive(arg1: "value", arg2: "value", arg3: "value")
      }
    `);
  });

  it('duplicate field arguments', () => {
    expectFailsRule(UniqueArgumentNames, `
      {
        field(arg1: "value", arg1: "value")
      }
    `, [
      duplicateArg('arg1', 3, 15, 3, 30)
    ]);
  });

  it('many duplicate field arguments', () => {
    expectFailsRule(UniqueArgumentNames, `
      {
        field(arg1: "value", arg1: "value", arg1: "value")
      }
    `, [
      duplicateArg('arg1', 3, 15, 3, 30),
      duplicateArg('arg1', 3, 15, 3, 45)
    ]);
  });

  it('duplicate directive arguments', () => {
    expectFailsRule(UniqueArgumentNames, `
      {
        field @directive(arg1: "value", arg1: "value")
      }
    `, [
      duplicateArg('arg1', 3, 26, 3, 41)
    ]);
  });

  it('many duplicate directive arguments', () => {
    expectFailsRule(UniqueArgumentNames, `
      {
        field @directive(arg1: "value", arg1: "value", arg1: "value")
      }
    `, [
      duplicateArg('arg1', 3, 26, 3, 41),
      duplicateArg('arg1', 3, 26, 3, 56)
    ]);
  });

});
