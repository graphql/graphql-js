/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { StarWarsSchema } from './starWarsSchema.js';
import { Source } from '../language/source';
import { parse } from '../language/parser';
import { validateDocument } from '../validator';

// 80+ char lines are useful in describe/it, so ignore in this file.
/*eslint-disable max-len */

/**
 * Helper function to test a query and the expected response.
 */
function validationResult(query) {
  var source = new Source(query || '', 'GraphQL request');
  var ast = parse(source);
  return validateDocument(StarWarsSchema, ast);
}

describe('Star Wars Validation Tests', () => {
  describe('Basic Queries', () => {
    it('Validates a complex but valid query', () => {
      var query = `
        query NestedQueryWithFragment {
          hero {
            ...NameAndAppearances
            friends {
              ...NameAndAppearances
              friends {
                ...NameAndAppearances
              }
            }
          }
        }

        fragment NameAndAppearances on Character {
          name
          appearsIn
        }
      `;
      return expect(validationResult(query).isValid).to.be.true;
    });

    it('Notes that non-existent fields are invalid', () => {
      var query = `
        query HeroSpaceshipQuery {
          hero {
            favoriteSpaceship
          }
        }
      `;
      return expect(validationResult(query).isValid).to.be.false;
    });

    it('Requires fields on objects', () => {
      var query = `
        query HeroNoFieldsQuery {
          hero
        }
      `;
      return expect(validationResult(query).isValid).to.be.false;
    });

    it('Disallows fields on scalars', () => {
      var query = `
        query HeroFieldsOnScalarQuery {
          hero {
            name {
              firstCharacterOfName
            }
          }
        }
      `;
      return expect(validationResult(query).isValid).to.be.false;
    });

    it('Disallows object fields on interfaces', () => {
      var query = `
        query DroidFieldOnCharacter {
          hero {
            name
            primaryFunction
          }
        }
      `;
      return expect(validationResult(query).isValid).to.be.false;
    });

    it('Allows object fields in fragments', () => {
      var query = `
        query DroidFieldInFragment {
          hero {
            name
            ...DroidFields
          }
        }

        fragment DroidFields on Droid {
          primaryFunction
        }
      `;
      return expect(validationResult(query).isValid).to.be.true;
    });

    it('Allows object fields in inline fragments', () => {
      var query = `
        query DroidFieldInFragment {
          hero {
            name
            ... on Droid {
              primaryFunction
            }
          }
        }
      `;
      return expect(validationResult(query).isValid).to.be.true;
    });
  });
});
