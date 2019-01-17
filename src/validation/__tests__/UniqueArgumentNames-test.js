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
  UniqueArgumentNames,
  duplicateArgMessage,
} from '../rules/UniqueArgumentNames';

function expectErrors(queryStr) {
  return expectValidationErrors(UniqueArgumentNames, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

function duplicateArg(argName, l1, c1, l2, c2) {
  return {
    message: duplicateArgMessage(argName),
    locations: [{ line: l1, column: c1 }, { line: l2, column: c2 }],
  };
}

describe('Validate: Unique argument names', () => {
  it('no arguments on field', () => {
    expectValid(`
      {
        field
      }
    `);
  });

  it('no arguments on directive', () => {
    expectValid(`
      {
        field @directive
      }
    `);
  });

  it('argument on field', () => {
    expectValid(`
      {
        field(arg: "value")
      }
    `);
  });

  it('argument on directive', () => {
    expectValid(`
      {
        field @directive(arg: "value")
      }
    `);
  });

  it('same argument on two fields', () => {
    expectValid(`
      {
        one: field(arg: "value")
        two: field(arg: "value")
      }
    `);
  });

  it('same argument on field and directive', () => {
    expectValid(`
      {
        field(arg: "value") @directive(arg: "value")
      }
    `);
  });

  it('same argument on two directives', () => {
    expectValid(`
      {
        field @directive1(arg: "value") @directive2(arg: "value")
      }
    `);
  });

  it('multiple field arguments', () => {
    expectValid(`
      {
        field(arg1: "value", arg2: "value", arg3: "value")
      }
    `);
  });

  it('multiple directive arguments', () => {
    expectValid(`
      {
        field @directive(arg1: "value", arg2: "value", arg3: "value")
      }
    `);
  });

  it('duplicate field arguments', () => {
    expectErrors(`
      {
        field(arg1: "value", arg1: "value")
      }
    `).to.deep.equal([duplicateArg('arg1', 3, 15, 3, 30)]);
  });

  it('many duplicate field arguments', () => {
    expectErrors(`
      {
        field(arg1: "value", arg1: "value", arg1: "value")
      }
    `).to.deep.equal([
      duplicateArg('arg1', 3, 15, 3, 30),
      duplicateArg('arg1', 3, 15, 3, 45),
    ]);
  });

  it('duplicate directive arguments', () => {
    expectErrors(`
      {
        field @directive(arg1: "value", arg1: "value")
      }
    `).to.deep.equal([duplicateArg('arg1', 3, 26, 3, 41)]);
  });

  it('many duplicate directive arguments', () => {
    expectErrors(`
      {
        field @directive(arg1: "value", arg1: "value", arg1: "value")
      }
    `).to.deep.equal([
      duplicateArg('arg1', 3, 26, 3, 41),
      duplicateArg('arg1', 3, 26, 3, 56),
    ]);
  });
});
