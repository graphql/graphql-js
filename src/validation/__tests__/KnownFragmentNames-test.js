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
  KnownFragmentNames,
  unknownFragmentMessage,
} from '../rules/KnownFragmentNames';

function expectErrors(queryStr) {
  return expectValidationErrors(KnownFragmentNames, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

function unknownFragment(fragName, line, column) {
  return {
    message: unknownFragmentMessage(fragName),
    locations: [{ line, column }],
  };
}

describe('Validate: Known fragment names', () => {
  it('known fragment names are valid', () => {
    expectValid(`
      {
        human(id: 4) {
          ...HumanFields1
          ... on Human {
            ...HumanFields2
          }
          ... {
            name
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

  it('unknown fragment names are invalid', () => {
    expectErrors(`
      {
        human(id: 4) {
          ...UnknownFragment1
          ... on Human {
            ...UnknownFragment2
          }
        }
      }
      fragment HumanFields on Human {
        name
        ...UnknownFragment3
      }
    `).to.deep.equal([
      unknownFragment('UnknownFragment1', 4, 14),
      unknownFragment('UnknownFragment2', 6, 16),
      unknownFragment('UnknownFragment3', 12, 12),
    ]);
  });
});
