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
  NoUnusedFragments,
  unusedFragMessage,
} from '../rules/NoUnusedFragments';


function unusedFrag(fragName, line, column) {
  return {
    message: unusedFragMessage(fragName),
    locations: [ { line, column } ],
  };
}

describe('Validate: No unused fragments', () => {

  it('all fragment names are used', () => {
    expectPassesRule(NoUnusedFragments, `
      {
        human(id: 4) {
          ...HumanFields1
          ... on Human {
            ...HumanFields2
          }
        }
      }
      fragment HumanFields1 on Human {
        name
        ...HumanFields3
      }
      fragment HumanFields2 on Human {
        name
      }
      fragment HumanFields3 on Human {
        name
      }
    `);
  });


  it('all fragment names are used by multiple operations', () => {
    expectPassesRule(NoUnusedFragments, `
      query Foo {
        human(id: 4) {
          ...HumanFields1
        }
      }
      query Bar {
        human(id: 4) {
          ...HumanFields2
        }
      }
      fragment HumanFields1 on Human {
        name
        ...HumanFields3
      }
      fragment HumanFields2 on Human {
        name
      }
      fragment HumanFields3 on Human {
        name
      }
    `);
  });

  it('contains unknown fragments', () => {
    expectFailsRule(NoUnusedFragments, `
      query Foo {
        human(id: 4) {
          ...HumanFields1
        }
      }
      query Bar {
        human(id: 4) {
          ...HumanFields2
        }
      }
      fragment HumanFields1 on Human {
        name
        ...HumanFields3
      }
      fragment HumanFields2 on Human {
        name
      }
      fragment HumanFields3 on Human {
        name
      }
      fragment Unused1 on Human {
        name
      }
      fragment Unused2 on Human {
        name
      }
    `, [
      unusedFrag('Unused1', 22, 7),
      unusedFrag('Unused2', 25, 7),
    ]);
  });

  it('contains unknown fragments with ref cycle', () => {
    expectFailsRule(NoUnusedFragments, `
      query Foo {
        human(id: 4) {
          ...HumanFields1
        }
      }
      query Bar {
        human(id: 4) {
          ...HumanFields2
        }
      }
      fragment HumanFields1 on Human {
        name
        ...HumanFields3
      }
      fragment HumanFields2 on Human {
        name
      }
      fragment HumanFields3 on Human {
        name
      }
      fragment Unused1 on Human {
        name
        ...Unused2
      }
      fragment Unused2 on Human {
        name
        ...Unused1
      }
    `, [
      unusedFrag('Unused1', 22, 7),
      unusedFrag('Unused2', 26, 7),
    ]);
  });

  it('contains unknown and undef fragments', () => {
    expectFailsRule(NoUnusedFragments, `
      query Foo {
        human(id: 4) {
          ...bar
        }
      }
      fragment foo on Human {
        name
      }
    `, [
      unusedFrag('foo', 7, 7),
    ]);
  });

});
