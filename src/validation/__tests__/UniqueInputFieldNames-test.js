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
  UniqueInputFieldNames,
  duplicateInputFieldMessage,
} from '../rules/UniqueInputFieldNames';


function duplicateField(name, l1, c1, l2, c2) {
  return {
    message: duplicateInputFieldMessage(name),
    locations: [ { line: l1, column: c1 }, { line: l2, column: c2 } ],
  };
}

describe('Validate: Unique input field names', () => {

  it('input object with fields', () => {
    expectPassesRule(UniqueInputFieldNames, `
      {
        field(arg: { f: true })
      }
    `);
  });

  it('same input object within two args', () => {
    expectPassesRule(UniqueInputFieldNames, `
      {
        field(arg1: { f: true }, arg2: { f: true })
      }
    `);
  });

  it('multiple input object fields', () => {
    expectPassesRule(UniqueInputFieldNames, `
      {
        field(arg: { f1: "value", f2: "value", f3: "value" })
      }
    `);
  });

  it('allows for nested input objects with similar fields', () => {
    expectPassesRule(UniqueInputFieldNames, `
      {
        field(arg: {
          deep: {
            deep: {
              id: 1
            }
            id: 1
          }
          id: 1
        })
      }
    `);
  });

  it('duplicate input object fields', () => {
    expectFailsRule(UniqueInputFieldNames, `
      {
        field(arg: { f1: "value", f1: "value" })
      }
    `, [
      duplicateField('f1', 3, 22, 3, 35)
    ]);
  });

  it('many duplicate input object fields', () => {
    expectFailsRule(UniqueInputFieldNames, `
      {
        field(arg: { f1: "value", f1: "value", f1: "value" })
      }
    `, [
      duplicateField('f1', 3, 22, 3, 35),
      duplicateField('f1', 3, 22, 3, 48)
    ]);
  });

});
