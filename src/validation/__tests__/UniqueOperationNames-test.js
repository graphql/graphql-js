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
  UniqueOperationNames,
  duplicateOperationNameMessage,
} from '../rules/UniqueOperationNames';

function expectErrors(queryStr) {
  return expectValidationErrors(UniqueOperationNames, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

function duplicateOp(opName, l1, c1, l2, c2) {
  return {
    message: duplicateOperationNameMessage(opName),
    locations: [{ line: l1, column: c1 }, { line: l2, column: c2 }],
  };
}

describe('Validate: Unique operation names', () => {
  it('no operations', () => {
    expectValid(`
      fragment fragA on Type {
        field
      }
    `);
  });

  it('one anon operation', () => {
    expectValid(`
      {
        field
      }
    `);
  });

  it('one named operation', () => {
    expectValid(`
      query Foo {
        field
      }
    `);
  });

  it('multiple operations', () => {
    expectValid(`
      query Foo {
        field
      }

      query Bar {
        field
      }
    `);
  });

  it('multiple operations of different types', () => {
    expectValid(`
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
    expectValid(`
      query Foo {
        ...Foo
      }
      fragment Foo on Type {
        field
      }
    `);
  });

  it('multiple operations of same name', () => {
    expectErrors(`
      query Foo {
        fieldA
      }
      query Foo {
        fieldB
      }
    `).to.deep.equal([duplicateOp('Foo', 2, 13, 5, 13)]);
  });

  it('multiple ops of same name of different types (mutation)', () => {
    expectErrors(`
      query Foo {
        fieldA
      }
      mutation Foo {
        fieldB
      }
    `).to.deep.equal([duplicateOp('Foo', 2, 13, 5, 16)]);
  });

  it('multiple ops of same name of different types (subscription)', () => {
    expectErrors(`
      query Foo {
        fieldA
      }
      subscription Foo {
        fieldB
      }
    `).to.deep.equal([duplicateOp('Foo', 2, 13, 5, 20)]);
  });
});
