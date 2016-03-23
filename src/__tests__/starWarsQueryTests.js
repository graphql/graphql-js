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
});
