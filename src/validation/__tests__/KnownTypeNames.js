/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { describe, it } from 'mocha';
import { expectPassesRule, expectFailsRule, expectPassesRuleWithSchema, testSchema } from './harness';
import { extendSchema } from '../../utilities/extendSchema';
import { parse } from '../../language';
import {
  KnownTypeNames,
  unknownTypeMessage,
} from '../rules/KnownTypeNames';


function unknownType(typeName, line, column) {
  return {
    message: unknownTypeMessage(typeName),
    locations: [ { line, column } ],
  };
}

describe('Validate: Known type names', () => {

  it('known type names are valid', () => {
    expectPassesRule(KnownTypeNames, `
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
    expectFailsRule(KnownTypeNames, `
      query Foo($var: JumbledUpLetters) {
        user(id: 4) {
          name
          pets { ... on Badger { name }, ...PetFields }
        }
      }
      fragment PetFields on Peettt {
        name
      }
    `, [
      unknownType('JumbledUpLetters', 2, 23),
      unknownType('Badger', 5, 25),
      unknownType('Peettt', 8, 29)
    ]);
  });

  it('types that are not in the schema don\'t need to be checked', () => {
    // both types A and B are not part of the schema because nobody is
    // referencing them
    var clientSideTypes = `
        type A { name: String }
        type B { a: A }`;
    var schema = extendSchema(testSchema, parse(clientSideTypes));
    expectPassesRuleWithSchema(schema, KnownTypeNames, clientSideTypes);
  });

});
