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
import { graphql } from '../graphql';
import {
  GraphQLObjectType,
  GraphQLNonNull,
  GraphQLSchema,
  GraphQLString,
} from '../type';

// 80+ char lines are useful in describe/it, so ignore in this file.
/* eslint-disable max-len */

describe('Star Wars Query Tests', () => {
  describe('Basic Queries', () => {
    it('Correctly identifies R2-D2 as the hero of the Star Wars Saga', async () => {
      const query = `
        query HeroNameQuery {
          hero {
            name
          }
        }
      `;
      const expected = {
        hero: {
          name: 'R2-D2'
        }
      };
      const result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows us to query for the ID and friends of R2-D2', async () => {
      const query = `
        query HeroNameAndFriendsQuery {
          hero {
            id
            name
            friends {
              name
            }
          }
        }
      `;
      const expected = {
        hero: {
          id: '2001',
          name: 'R2-D2',
          friends: [
            {
              name: 'Luke Skywalker',
            },
            {
              name: 'Han Solo',
            },
            {
              name: 'Leia Organa',
            },
          ]
        }
      };
      const result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });
  });

  describe('Nested Queries', () => {
    it('Allows us to query for the friends of friends of R2-D2', async () => {
      const query = `
        query NestedQuery {
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
      `;
      const expected = {
        hero: {
          name: 'R2-D2',
          friends: [
            {
              name: 'Luke Skywalker',
              appearsIn: [ 'NEWHOPE', 'EMPIRE', 'JEDI' ],
              friends: [
                {
                  name: 'Han Solo',
                },
                {
                  name: 'Leia Organa',
                },
                {
                  name: 'C-3PO',
                },
                {
                  name: 'R2-D2',
                },
              ]
            },
            {
              name: 'Han Solo',
              appearsIn: [ 'NEWHOPE', 'EMPIRE', 'JEDI' ],
              friends: [
                {
                  name: 'Luke Skywalker',
                },
                {
                  name: 'Leia Organa',
                },
                {
                  name: 'R2-D2',
                },
              ]
            },
            {
              name: 'Leia Organa',
              appearsIn: [ 'NEWHOPE', 'EMPIRE', 'JEDI' ],
              friends: [
                {
                  name: 'Luke Skywalker',
                },
                {
                  name: 'Han Solo',
                },
                {
                  name: 'C-3PO',
                },
                {
                  name: 'R2-D2',
                },
              ]
            },
          ]
        }
      };
      const result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });
  });

  describe('Using IDs and query parameters to refetch objects', () => {
    it('Allows us to query for Luke Skywalker directly, using his ID', async () => {
      const query = `
        query FetchLukeQuery {
          human(id: "1000") {
            name
          }
        }
      `;
      const expected = {
        human: {
          name: 'Luke Skywalker'
        }
      };
      const result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows us to create a generic query, then use it to fetch Luke Skywalker using his ID', async () => {
      const query = `
        query FetchSomeIDQuery($someId: String!) {
          human(id: $someId) {
            name
          }
        }
      `;
      const params = {
        someId: '1000'
      };
      const expected = {
        human: {
          name: 'Luke Skywalker'
        }
      };
      const result = await graphql(StarWarsSchema, query, null, null, params);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows us to create a generic query, then use it to fetch Han Solo using his ID', async () => {
      const query = `
        query FetchSomeIDQuery($someId: String!) {
          human(id: $someId) {
            name
          }
        }
      `;
      const params = {
        someId: '1002'
      };
      const expected = {
        human: {
          name: 'Han Solo'
        }
      };
      const result = await graphql(StarWarsSchema, query, null, null, params);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows us to create a generic query, then pass an invalid ID to get null back', async () => {
      const query = `
        query humanQuery($id: String!) {
          human(id: $id) {
            name
          }
        }
      `;
      const params = {
        id: 'not a valid id'
      };
      const expected = {
        human: null
      };
      const result = await graphql(StarWarsSchema, query, null, null, params);
      expect(result).to.deep.equal({ data: expected });
    });
  });

  describe('Using aliases to change the key in the response', () => {
    it('Allows us to query for Luke, changing his key with an alias', async () => {
      const query = `
        query FetchLukeAliased {
          luke: human(id: "1000") {
            name
          }
        }
      `;
      const expected = {
        luke: {
          name: 'Luke Skywalker'
        },
      };
      const result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows us to query for both Luke and Leia, using two root fields and an alias', async () => {
      const query = `
        query FetchLukeAndLeiaAliased {
          luke: human(id: "1000") {
            name
          }
          leia: human(id: "1003") {
            name
          }
        }
      `;
      const expected = {
        luke: {
          name: 'Luke Skywalker'
        },
        leia: {
          name: 'Leia Organa'
        }
      };
      const result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });
  });

  describe('Uses fragments to express more complex queries', () => {
    it('Allows us to query using duplicated content', async () => {
      const query = `
        query DuplicateFields {
          luke: human(id: "1000") {
            name
            homePlanet
          }
          leia: human(id: "1003") {
            name
            homePlanet
          }
        }
      `;
      const expected = {
        luke: {
          name: 'Luke Skywalker',
          homePlanet: 'Tatooine'
        },
        leia: {
          name: 'Leia Organa',
          homePlanet: 'Alderaan'
        }
      };
      const result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows us to use a fragment to avoid duplicating content', async () => {
      const query = `
        query UseFragment {
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
      `;
      const expected = {
        luke: {
          name: 'Luke Skywalker',
          homePlanet: 'Tatooine'
        },
        leia: {
          name: 'Leia Organa',
          homePlanet: 'Alderaan'
        }
      };
      const result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });
  });

  describe('Using __typename to find the type of an object', () => {
    it('Allows us to verify that R2-D2 is a droid', async () => {
      const query = `
        query CheckTypeOfR2 {
          hero {
            __typename
            name
          }
        }
      `;
      const expected = {
        hero: {
          __typename: 'Droid',
          name: 'R2-D2'
        },
      };
      const result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows us to verify that Luke is a human', async () => {
      const query = `
        query CheckTypeOfLuke {
          hero(episode: EMPIRE) {
            __typename
            name
          }
        }
      `;
      const expected = {
        hero: {
          __typename: 'Human',
          name: 'Luke Skywalker'
        },
      };
      const result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });
  });

  describe('Reporting errors raised in resolvers', () => {
    it('Correctly reports error on accessing secretBackstory', async () => {
      const query = `
        query HeroNameQuery {
          hero {
            name
            secretBackstory
          }
        }
      `;
      const expected = {
        hero: {
          name: 'R2-D2',
          secretBackstory: null
        }
      };
      const expectedErrors = [ 'secretBackstory is secret.' ];
      const result = await graphql(StarWarsSchema, query);
      expect(result.data).to.deep.equal(expected);
      expect(result.errors.map(e => e.message)).to.deep.equal(expectedErrors);
      expect(
        result.errors.map(e => e.path)).to.deep.equal(
          [ [ 'hero', 'secretBackstory' ] ]);
    });

    it('Correctly reports error on accessing secretBackstory in a list', async () => {
      const query = `
        query HeroNameQuery {
          hero {
            name
            friends {
              name
              secretBackstory
            }
          }
        }
      `;
      const expected = {
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
          ]
        }
      };
      const expectedErrors = [
        'secretBackstory is secret.',
        'secretBackstory is secret.',
        'secretBackstory is secret.',
      ];
      const result = await graphql(StarWarsSchema, query);
      expect(result.data).to.deep.equal(expected);
      expect(result.errors.map(e => e.message)).to.deep.equal(expectedErrors);
      expect(
        result.errors.map(e => e.path)
      ).to.deep.equal(
        [
          [ 'hero', 'friends', 0, 'secretBackstory' ],
          [ 'hero', 'friends', 1, 'secretBackstory' ],
          [ 'hero', 'friends', 2, 'secretBackstory' ],
        ]);
    });

    it('Correctly reports error on accessing through an alias', async () => {
      const query = `
        query HeroNameQuery {
          mainHero: hero {
            name
            story: secretBackstory
          }
        }
      `;
      const expected = {
        mainHero: {
          name: 'R2-D2',
          story: null,
        }
      };
      const expectedErrors = [
        'secretBackstory is secret.',
      ];
      const result = await graphql(StarWarsSchema, query);
      expect(result.data).to.deep.equal(expected);
      expect(result.errors.map(e => e.message)).to.deep.equal(expectedErrors);
      expect(
        result.errors.map(e => e.path)
      ).to.deep.equal([ [ 'mainHero', 'story' ] ]);
    });

    it('Full response path is included when fields are non-nullable', async () => {
      const A = new GraphQLObjectType({
        name: 'A',
        fields: () => ({
          nullableA: {
            type: A,
            resolve: () => ({}),
          },
          nonNullA: {
            type: new GraphQLNonNull(A),
            resolve: () => ({}),
          },
          throws: {
            type: new GraphQLNonNull(GraphQLString),
            resolve: () => { throw new Error('Catch me if you can'); },
          },
        }),
      });
      const queryType = new GraphQLObjectType({
        name: 'query',
        fields: () => ({
          nullableA: {
            type: A,
            resolve: () => ({})
          }
        }),
      });
      const schema = new GraphQLSchema({
        query: queryType,
      });

      const query = `
        query {
          nullableA {
            nullableA {
              nonNullA {
                nonNullA {
                  throws
                }
              }
            }
          }
        }
      `;

      const result = await graphql(schema, query);
      const expected = {
        nullableA: {
          nullableA: null
        }
      };
      expect(result.data).to.deep.equal(expected);
      expect(
        result.errors.map(e => e.path)).to.deep.equal(
          [ [ 'nullableA', 'nullableA', 'nonNullA', 'nonNullA', 'throws' ] ]);
    });
  });
});
