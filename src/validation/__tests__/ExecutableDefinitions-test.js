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
  ExecutableDefinitions,
  nonExecutableDefinitionMessage,
} from '../rules/ExecutableDefinitions';

function expectErrors(queryStr) {
  return expectValidationErrors(ExecutableDefinitions, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

function nonExecutableDefinition(defName, line, column) {
  return {
    message: nonExecutableDefinitionMessage(defName),
    locations: [{ line, column }],
  };
}

describe('Validate: Executable definitions', () => {
  it('with only operation', () => {
    expectValid(`
      query Foo {
        dog {
          name
        }
      }
    `);
  });

  it('with operation and fragment', () => {
    expectValid(`
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
    expectErrors(`
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
    `).to.deep.equal([
      nonExecutableDefinition('Cow', 8, 7),
      nonExecutableDefinition('Dog', 12, 7),
    ]);
  });

  it('with schema definition', () => {
    expectErrors(`
      schema {
        query: Query
      }

      type Query {
        test: String
      }

      extend schema @directive
    `).to.deep.equal([
      nonExecutableDefinition('schema', 2, 7),
      nonExecutableDefinition('Query', 6, 7),
      nonExecutableDefinition('schema', 10, 7),
    ]);
  });
});
