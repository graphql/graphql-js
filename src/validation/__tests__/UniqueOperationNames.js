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
  UniqueOperationNames,
  duplicateOperationNameMessage,
} from '../rules/UniqueOperationNames';


function duplicateOp(opName, l1, c1, l2, c2) {
  return {
    message: duplicateOperationNameMessage(opName),
    locations: [ { line: l1, column: c1 }, { line: l2, column: c2 } ],
  };
}

describe('Validate: Unique operation names', () => {

  it('no operations', () => {
    expectPassesRule(UniqueOperationNames, `
      fragment fragA on Type {
        field
      }
    `);
  });

  it('one anon operation', () => {
    expectPassesRule(UniqueOperationNames, `
      {
        field
      }
    `);
  });

  it('one named operation', () => {
    expectPassesRule(UniqueOperationNames, `
      query Foo {
        field
      }
    `);
  });

  it('multiple operations', () => {
    expectPassesRule(UniqueOperationNames, `
      query Foo {
        field
      }

      query Bar {
        field
      }
    `);
  });

  it('multiple operations of different types', () => {
    expectPassesRule(UniqueOperationNames, `
      query Foo {
        field
      }

      mutation Bar {
        field
      }

      subscription Baz {
        field
      }
    `);
  });

  it('fragment and operation named the same', () => {
    expectPassesRule(UniqueOperationNames, `
      query Foo {
        ...Foo
      }
      fragment Foo on Type {
        field
      }
    `);
  });

  it('multiple operations of same name', () => {
    expectFailsRule(UniqueOperationNames, `
      query Foo {
        fieldA
      }
      query Foo {
        fieldB
      }
    `, [
      duplicateOp('Foo', 2, 13, 5, 13)
    ]);
  });

  it('multiple ops of same name of different types (mutation)', () => {
    expectFailsRule(UniqueOperationNames, `
      query Foo {
        fieldA
      }
      mutation Foo {
        fieldB
      }
    `, [
      duplicateOp('Foo', 2, 13, 5, 16)
    ]);
  });

  it('multiple ops of same name of different types (subscription)', () => {
    expectFailsRule(UniqueOperationNames, `
      query Foo {
        fieldA
      }
      subscription Foo {
        fieldB
      }
    `, [
      duplicateOp('Foo', 2, 13, 5, 20)
    ]);
  });

});
