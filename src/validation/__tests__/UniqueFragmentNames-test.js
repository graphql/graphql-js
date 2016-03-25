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
  UniqueFragmentNames,
  duplicateFragmentNameMessage,
} from '../rules/UniqueFragmentNames';


function duplicateFrag(fragName, l1, c1, l2, c2) {
  return {
    message: duplicateFragmentNameMessage(fragName),
    locations: [ { line: l1, column: c1 }, { line: l2, column: c2 } ],
  };
}

describe('Validate: Unique fragment names', () => {

  it('no fragments', () => {
    expectPassesRule(UniqueFragmentNames, `
      {
        field
      }
    `);
  });

  it('one fragment', () => {
    expectPassesRule(UniqueFragmentNames, `
      {
        ...fragA
      }

      fragment fragA on Type {
        field
      }
    `);
  });

  it('many fragments', () => {
    expectPassesRule(UniqueFragmentNames, `
      {
        ...fragA
        ...fragB
        ...fragC
      }
      fragment fragA on Type {
        fieldA
      }
      fragment fragB on Type {
        fieldB
      }
      fragment fragC on Type {
        fieldC
      }
    `);
  });

  it('inline fragments are always unique', () => {
    expectPassesRule(UniqueFragmentNames, `
      {
        ...on Type {
          fieldA
        }
        ...on Type {
          fieldB
        }
      }
    `);
  });

  it('fragment and operation named the same', () => {
    expectPassesRule(UniqueFragmentNames, `
      query Foo {
        ...Foo
      }
      fragment Foo on Type {
        field
      }
    `);
  });

  it('fragments named the same', () => {
    expectFailsRule(UniqueFragmentNames, `
      {
        ...fragA
      }
      fragment fragA on Type {
        fieldA
      }
      fragment fragA on Type {
        fieldB
      }
    `, [
      duplicateFrag('fragA', 5, 16, 8, 16)
    ]);
  });

  it('fragments named the same without being referenced', () => {
    expectFailsRule(UniqueFragmentNames, `
      fragment fragA on Type {
        fieldA
      }
      fragment fragA on Type {
        fieldB
      }
    `, [
      duplicateFrag('fragA', 2, 16, 5, 16)
    ]);
  });

});
