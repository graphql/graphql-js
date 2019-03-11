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
  NoUnusedFragments,
  unusedFragMessage,
} from '../rules/NoUnusedFragments';

function expectErrors(queryStr) {
  return expectValidationErrors(NoUnusedFragments, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

function unusedFrag(fragName, line, column) {
  return {
    message: unusedFragMessage(fragName),
    locations: [{ line, column }],
  };
}

describe('Validate: No unused fragments', () => {
  it('all fragment names are used', () => {
    expectValid(`
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
    expectValid(`
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
    expectErrors(`
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
    `).to.deep.equal([
      unusedFrag('Unused1', 22, 7),
      unusedFrag('Unused2', 25, 7),
    ]);
  });

  it('contains unknown fragments with ref cycle', () => {
    expectErrors(`
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
    `).to.deep.equal([
      unusedFrag('Unused1', 22, 7),
      unusedFrag('Unused2', 26, 7),
    ]);
  });

  it('contains unknown and undef fragments', () => {
    expectErrors(`
      query Foo {
        human(id: 4) {
          ...bar
        }
      }
      fragment foo on Human {
        name
      }
    `).to.deep.equal([unusedFrag('foo', 7, 7)]);
  });
});
