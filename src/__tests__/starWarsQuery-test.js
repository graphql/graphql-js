/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { StarWarsSchema, Query } from './starWarsSchema';
import { graphql } from '../graphql';

function executeQuery(query, variableValues) {
  return graphql(StarWarsSchema, query, new Query(), null, variableValues);
}

describe('Star Wars Query Tests', () => {
  describe('Basic Queries', () => {
    it('Correctly identifies R2-D2 as the hero of the Star Wars Saga', async () => {
      const result = await executeQuery(`
        {
          hero {
            name
          }
        }
      `);

      expect(result).to.deep.equal({
        data: {
          hero: { name: 'R2-D2' },
        },
      });
    });

    it('Accepts an object with named properties to graphql()', async () => {
      const result = await executeQuery(`
        {
          hero {
            name
          }
        }
      `);

      expect(result).to.deep.equal({
        data: {
          hero: { name: 'R2-D2' },
        },
      });
    });

    it('Allows us to query for the ID and friends of R2-D2', async () => {
      const result = await executeQuery(`
        {
          hero {
            id
            name
            friends {
              name
            }
          }
        }
      `);

      expect(result).to.deep.equal({
        data: {
          hero: {
            id: '2001',
            name: 'R2-D2',
            friends: [
              { name: 'Luke Skywalker' },
              { name: 'Han Solo' },
              { name: 'Leia Organa' },
            ],
          },
        },
      });
    });
  });

  describe('Nested Queries', () => {
    it('Allows us to query for the friends of friends of R2-D2', async () => {
      const result = await executeQuery(`
        {
          hero {
            name
            friends {
              name
              appearsIn
              friends {
                name
              }
            }
          }
        }
      `);

      expect(result).to.deep.equal({
        data: {
          hero: {
            name: 'R2-D2',
            friends: [
              {
                name: 'Luke Skywalker',
                appearsIn: ['NEWHOPE', 'EMPIRE', 'JEDI'],
                friends: [
                  { name: 'Han Solo' },
                  { name: 'Leia Organa' },
                  { name: 'C-3PO' },
                  { name: 'R2-D2' },
                ],
              },
              {
                name: 'Han Solo',
                appearsIn: ['NEWHOPE', 'EMPIRE', 'JEDI'],
                friends: [
                  { name: 'Luke Skywalker' },
                  { name: 'Leia Organa' },
                  { name: 'R2-D2' },
                ],
              },
              {
                name: 'Leia Organa',
                appearsIn: ['NEWHOPE', 'EMPIRE', 'JEDI'],
                friends: [
                  { name: 'Luke Skywalker' },
                  { name: 'Han Solo' },
                  { name: 'C-3PO' },
                  { name: 'R2-D2' },
                ],
              },
            ],
          },
        },
      });
    });
  });

  describe('Using IDs and query parameters to refetch objects', () => {
    it('Allows us to query for Luke Skywalker directly, using his ID', async () => {
      const result = await executeQuery(`
        {
          human(id: "1000") {
            name
          }
        }
      `);

      expect(result).to.deep.equal({
        data: {
          human: { name: 'Luke Skywalker' },
        },
      });
    });

    it('Allows us to create a generic query, then use it to fetch Luke Skywalker using his ID', async () => {
      const query = `
        query ($someId: String!) {
          human(id: $someId) {
            name
          }
        }
      `;
      const result = await executeQuery(query, { someId: '1000' });

      expect(result).to.deep.equal({
        data: {
          human: { name: 'Luke Skywalker' },
        },
      });
    });

    it('Allows us to create a generic query, then use it to fetch Han Solo using his ID', async () => {
      const query = `
        query ($someId: String!) {
          human(id: $someId) {
            name
          }
        }
      `;
      const result = await executeQuery(query, { someId: '1002' });

      expect(result).to.deep.equal({
        data: {
          human: { name: 'Han Solo' },
        },
      });
    });

    it('Allows us to create a generic query, then pass an invalid ID to get null back', async () => {
      const query = `
        query ($id: String!) {
          human(id: $id) {
            name
          }
        }
      `;
      const result = await executeQuery(query, { id: 'not a valid id' });

      expect(result).to.deep.equal({
        data: {
          human: null,
        },
      });
    });
  });

  describe('Using aliases to change the key in the response', () => {
    it('Allows us to query for Luke, changing his key with an alias', async () => {
      const result = await executeQuery(`
        {
          luke: human(id: "1000") {
            name
          }
        }
      `);

      expect(result).to.deep.equal({
        data: {
          luke: { name: 'Luke Skywalker' },
        },
      });
    });

    it('Allows us to query for both Luke and Leia, using two root fields and an alias', async () => {
      const result = await executeQuery(`
        {
          luke: human(id: "1000") {
            name
          }
          leia: human(id: "1003") {
            name
          }
        }
      `);

      expect(result).to.deep.equal({
        data: {
          luke: { name: 'Luke Skywalker' },
          leia: { name: 'Leia Organa' },
        },
      });
    });
  });

  describe('Uses fragments to express more complex queries', () => {
    it('Allows us to query using duplicated content', async () => {
      const result = await executeQuery(`
        {
          luke: human(id: "1000") {
            name
            homePlanet
          }
          leia: human(id: "1003") {
            name
            homePlanet
          }
        }
      `);

      expect(result).to.deep.equal({
        data: {
          luke: {
            name: 'Luke Skywalker',
            homePlanet: 'Tatooine',
          },
          leia: {
            name: 'Leia Organa',
            homePlanet: 'Alderaan',
          },
        },
      });
    });

    it('Allows us to use a fragment to avoid duplicating content', async () => {
      const result = await executeQuery(`
        {
          luke: human(id: "1000") {
            ...HumanFragment
          }
          leia: human(id: "1003") {
            ...HumanFragment
          }
        }

        fragment HumanFragment on Human {
          name
          homePlanet
        }
      `);

      expect(result).to.deep.equal({
        data: {
          luke: {
            name: 'Luke Skywalker',
            homePlanet: 'Tatooine',
          },
          leia: {
            name: 'Leia Organa',
            homePlanet: 'Alderaan',
          },
        },
      });
    });
  });

  describe('Using __typename to find the type of an object', () => {
    it('Allows us to verify that R2-D2 is a droid', async () => {
      const result = await executeQuery(`
        {
          hero {
            __typename
            name
          }
        }
      `);

      expect(result).to.deep.equal({
        data: {
          hero: {
            __typename: 'Droid',
            name: 'R2-D2',
          },
        },
      });
    });

    it('Allows us to verify that Luke is a human', async () => {
      const result = await executeQuery(`
        query CheckTypeOfLuke {
          hero(episode: EMPIRE) {
            __typename
            name
          }
        }
      `);

      expect(result).to.deep.equal({
        data: {
          hero: {
            __typename: 'Human',
            name: 'Luke Skywalker',
          },
        },
      });
    });
  });

  describe('Reporting errors raised in resolvers', () => {
    it('Correctly reports error on accessing secretBackstory', async () => {
      const result = await executeQuery(`
        {
          hero {
            name
            secretBackstory
          }
        }
      `);

      expect(result).to.deep.equal({
        data: {
          hero: {
            name: 'R2-D2',
            secretBackstory: null,
          },
        },
        errors: [
          {
            message: 'secretBackstory is secret.',
            locations: [{ line: 5, column: 13 }],
            path: ['hero', 'secretBackstory'],
          },
        ],
      });
    });

    it('Correctly reports error on accessing secretBackstory in a list', async () => {
      const result = await executeQuery(`
        {
          hero {
            name
            friends {
              name
              secretBackstory
            }
          }
        }
      `);

      expect(result).to.deep.equal({
        data: {
          hero: {
            name: 'R2-D2',
            friends: [
              {
                name: 'Luke Skywalker',
                secretBackstory: null,
              },
              {
                name: 'Han Solo',
                secretBackstory: null,
              },
              {
                name: 'Leia Organa',
                secretBackstory: null,
              },
            ],
          },
        },
        errors: [
          {
            message: 'secretBackstory is secret.',
            locations: [{ line: 7, column: 15 }],
            path: ['hero', 'friends', 0, 'secretBackstory'],
          },
          {
            message: 'secretBackstory is secret.',
            locations: [{ line: 7, column: 15 }],
            path: ['hero', 'friends', 1, 'secretBackstory'],
          },
          {
            message: 'secretBackstory is secret.',
            locations: [{ line: 7, column: 15 }],
            path: ['hero', 'friends', 2, 'secretBackstory'],
          },
        ],
      });
    });

    it('Correctly reports error on accessing through an alias', async () => {
      const result = await executeQuery(`
        {
          mainHero: hero {
            name
            story: secretBackstory
          }
        }
      `);

      expect(result).to.deep.equal({
        data: {
          mainHero: {
            name: 'R2-D2',
            story: null,
          },
        },
        errors: [
          {
            message: 'secretBackstory is secret.',
            locations: [{ line: 5, column: 13 }],
            path: ['mainHero', 'story'],
          },
        ],
      });
    });
  });
});
