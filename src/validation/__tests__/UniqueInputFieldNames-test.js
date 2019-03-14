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
  UniqueInputFieldNames,
  duplicateInputFieldMessage,
} from '../rules/UniqueInputFieldNames';

function expectErrors(queryStr) {
  return expectValidationErrors(UniqueInputFieldNames, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

function duplicateField(name, l1, c1, l2, c2) {
  return {
    message: duplicateInputFieldMessage(name),
    locations: [{ line: l1, column: c1 }, { line: l2, column: c2 }],
  };
}

describe('Validate: Unique input field names', () => {
  it('input object with fields', () => {
    expectValid(`
      {
        field(arg: { f: true })
      }
    `);
  });

  it('same input object within two args', () => {
    expectValid(`
      {
        field(arg1: { f: true }, arg2: { f: true })
      }
    `);
  });

  it('multiple input object fields', () => {
    expectValid(`
      {
        field(arg: { f1: "value", f2: "value", f3: "value" })
      }
    `);
  });

  it('allows for nested input objects with similar fields', () => {
    expectValid(`
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
    expectErrors(`
      {
        field(arg: { f1: "value", f1: "value" })
      }
    `).to.deep.equal([duplicateField('f1', 3, 22, 3, 35)]);
  });

  it('many duplicate input object fields', () => {
    expectErrors(`
      {
        field(arg: { f1: "value", f1: "value", f1: "value" })
      }
    `).to.deep.equal([
      duplicateField('f1', 3, 22, 3, 35),
      duplicateField('f1', 3, 22, 3, 48),
    ]);
  });

  it('nested duplicate input object fields', () => {
    expectErrors(`
      {
        field(arg: { f1: {f2: "value", f2: "value" }})
      }
    `).to.deep.equal([duplicateField('f2', 3, 27, 3, 40)]);
  });
});
