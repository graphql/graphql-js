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
  KnownFragmentNames,
  unknownFragmentMessage,
} from '../rules/KnownFragmentNames';


function undefFrag(fragName, line, column) {
  return {
    message: unknownFragmentMessage(fragName),
    locations: [ { line, column } ]
  };
}

describe('Validate: Known fragment names', () => {

  it('known fragment names are valid', () => {
    expectPassesRule(KnownFragmentNames, `
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
    expectFailsRule(KnownFragmentNames, `
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
    `, [
      undefFrag('UnknownFragment1', 4, 14),
      undefFrag('UnknownFragment2', 6, 16),
      undefFrag('UnknownFragment3', 12, 12)
    ]);
  });

});
