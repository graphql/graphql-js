/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expectPassesRule, expectFailsRule } from './harness';
import {
  ExecutableDefinitions,
  nonExecutableDefinitionMessage,
} from '../rules/ExecutableDefinitions';

function nonExecutableDefinition(defName, line, column) {
  return {
    message: nonExecutableDefinitionMessage(defName),
    locations: [{ line, column }],
  };
}

describe('Validate: Executable definitions', () => {
  it('with only operation', () => {
    expectPassesRule(
      ExecutableDefinitions,
      `
      query Foo {
        dog {
          name
        }
      }
    `,
    );
  });

  it('with operation and fragment', () => {
    expectPassesRule(
      ExecutableDefinitions,
      `
      query Foo {
        dog {
          name
          ...Frag
        }
      }

      fragment Frag on Dog {
        name
      }
    `,
    );
  });

  it('with type definition', () => {
    expectFailsRule(
      ExecutableDefinitions,
      `
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
    `,
      [
        nonExecutableDefinition('Cow', 8, 7),
        nonExecutableDefinition('Dog', 12, 7),
      ],
    );
  });

  it('with schema definition', () => {
    expectFailsRule(
      ExecutableDefinitions,
      `
      schema {
        query: Query
      }

      type Query {
        test: String
      }

      extend schema @directive
    `,
      [
        nonExecutableDefinition('schema', 2, 7),
        nonExecutableDefinition('Query', 6, 7),
        nonExecutableDefinition('schema', 10, 7),
      ],
    );
  });
});
