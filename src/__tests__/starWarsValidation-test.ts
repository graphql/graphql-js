import { describe, it } from 'node:test';

import { expect } from 'chai';

import { parse } from '../language/parser.ts';
import { Source } from '../language/source.ts';

import { validate } from '../validation/validate.ts';

import { StarWarsSchema } from './starWarsSchema.ts';

/**
 * Helper function to test a query and the expected response.
 */
function validationErrors(query: string) {
  const source = new Source(query, 'StarWars.graphql');
  const ast = parse(source);
  return validate(StarWarsSchema, ast);
}

describe('Star Wars Validation Tests', () => {
  describe('Basic Queries', () => {
    it('Validates a complex but valid query', () => {
      const query = `
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
      expect(validationErrors(query)).to.deep.equal([]);
    });

    it('Notes that non-existent fields are invalid', () => {
      const query = `
        query HeroSpaceshipQuery {
          hero {
            favoriteSpaceship
          }
        }
      `;
      expect(validationErrors(query)).to.not.deep.equal([]);
    });

    it('Requires fields on objects', () => {
      const query = `
        query HeroNoFieldsQuery {
          hero
        }
      `;
      expect(validationErrors(query)).to.not.deep.equal([]);
    });

    it('Disallows fields on scalars', () => {
      const query = `
        query HeroFieldsOnScalarQuery {
          hero {
            name {
              firstCharacterOfName
            }
          }
        }
      `;
      expect(validationErrors(query)).to.not.deep.equal([]);
    });

    it('Disallows object fields on interfaces', () => {
      const query = `
        query DroidFieldOnCharacter {
          hero {
            name
            primaryFunction
          }
        }
      `;
      expect(validationErrors(query)).to.not.deep.equal([]);
    });

    it('Allows object fields in fragments', () => {
      const query = `
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
      expect(validationErrors(query)).to.deep.equal([]);
    });

    it('Allows object fields in inline fragments', () => {
      const query = `
        query DroidFieldInFragment {
          hero {
            name
            ... on Droid {
              primaryFunction
            }
          }
        }
      `;
      expect(validationErrors(query)).to.deep.equal([]);
    });
  });
});
