/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expectValidationErrors } from './harness';
import { KnownTypeNames, unknownTypeMessage } from '../rules/KnownTypeNames';

function expectErrors(queryStr) {
  return expectValidationErrors(KnownTypeNames, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

function unknownType(typeName, suggestedTypes, line, column) {
  return {
    message: unknownTypeMessage(typeName, suggestedTypes),
    locations: [{ line, column }],
  };
}

describe('Validate: Known type names', () => {
  it('known type names are valid', () => {
    expectValid(`
      query Foo($var: String, $required: [String!]!) {
        user(id: 4) {
          pets { ... on Pet { name }, ...PetFields, ... { name } }
        }
      }
      fragment PetFields on Pet {
        name
      }
    `);
  });

  it('unknown type names are invalid', () => {
    expectErrors(`
      query Foo($var: JumbledUpLetters) {
        user(id: 4) {
          name
          pets { ... on Badger { name }, ...PetFields }
        }
      }
      fragment PetFields on Peettt {
        name
      }
    `).to.deep.equal([
      unknownType('JumbledUpLetters', [], 2, 23),
      unknownType('Badger', [], 5, 25),
      unknownType('Peettt', ['Pet'], 8, 29),
    ]);
  });

  it('ignores type definitions', () => {
    expectErrors(`
      type NotInTheSchema {
        field: FooBar
      }
      interface FooBar {
        field: NotInTheSchema
      }
      union U = A | B
      input Blob {
        field: UnknownType
      }
      query Foo($var: NotInTheSchema) {
        user(id: $var) {
          id
        }
      }
    `).to.deep.equal([unknownType('NotInTheSchema', [], 12, 23)]);
  });
});
