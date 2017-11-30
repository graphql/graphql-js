/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// 80+ char lines are useful in tests, so ignore in this file.
/* eslint-disable max-len */

import { describe, it } from 'mocha';
import { expectPassesRule, expectFailsRule } from './harness';
import {
  ExecutableDefinitions,
  nonExecutableDefinitionMessage,
} from '../rules/ExecutableDefinitions';


function nonExecutableDefinition(defName, line, column) {
  return {
    message: nonExecutableDefinitionMessage(defName),
    locations: [ { line, column } ],
    path: undefined,
  };
}

describe('Validate: Executable definitions', () => {

  it('with only operation', () => {
    expectPassesRule(ExecutableDefinitions, `
      query Foo {
        dog {
          name
        }
      }
    `);
  });

  it('with operation and fragment', () => {
    expectPassesRule(ExecutableDefinitions, `
      query Foo {
        dog {
          name
          ...Frag
        }
      }

      fragment Frag on Dog {
        name
      }
    `);
  });

  it('with type definition', () => {
    expectFailsRule(ExecutableDefinitions, `
      query Foo {
        dog {
          name
        }
      }

      type Cow {
        name: String
      }

      extend type Dog {
        color: String
      }
    `, [
        nonExecutableDefinition('Cow', 8, 12),
        nonExecutableDefinition('Dog', 12, 19),
      ]);
  });

});
