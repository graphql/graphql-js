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
      var query = `
        query HeroNameQuery {
          hero {
            name
          }
        }
      `;
      var expected = {
        hero: {
          name: 'R2-D2'
        }
      };
      var result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows us to query for the ID and friends of R2-D2', async () => {
      var query = `
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
      var expected = {
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
      var result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });
  });

  describe('Nested Queries', () => {
    it('Allows us to query for the friends of friends of R2-D2', async () => {
      var query = `
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
      var expected = {
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
      var result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });
  });

  describe('Using IDs and query parameters to refetch objects', () => {
    it('Allows us to query for Luke Skywalker directly, using his ID', async () => {
      var query = `
        query FetchLukeQuery {
          human(id: "1000") {
            name
          }
        }
      `;
      var expected = {
        human: {
          name: 'Luke Skywalker'
        }
      };
      var result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows us to create a generic query, then use it to fetch Luke Skywalker using his ID', async () => {
      var query = `
        query FetchSomeIDQuery($someId: String!) {
          human(id: $someId) {
            name
          }
        }
      `;
      var params = {
        someId: '1000'
      };
      var expected = {
        human: {
          name: 'Luke Skywalker'
        }
      };
      var result = await graphql(StarWarsSchema, query, null, params);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows us to create a generic query, then use it to fetch Han Solo using his ID', async () => {
      var query = `
        query FetchSomeIDQuery($someId: String!) {
          human(id: $someId) {
            name
          }
        }
      `;
      var params = {
        someId: '1002'
      };
      var expected = {
        human: {
          name: 'Han Solo'
        }
      };
      var result = await graphql(StarWarsSchema, query, null, params);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows us to create a generic query, then pass an invalid ID to get null back', async () => {
      var query = `
        query humanQuery($id: String!) {
          human(id: $id) {
            name
          }
        }
      `;
      var params = {
        id: 'not a valid id'
      };
      var expected = {
        human: null
      };
      var result = await graphql(StarWarsSchema, query, null, params);
      expect(result).to.deep.equal({ data: expected });
    });
  });

  describe('Using aliases to change the key in the response', () => {
    it('Allows us to query for Luke, changing his key with an alias', async () => {
      var query = `
        query FetchLukeAliased {
          luke: human(id: "1000") {
            name
          }
        }
      `;
      var expected = {
        luke: {
          name: 'Luke Skywalker'
        },
      };
      var result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows us to query for both Luke and Leia, using two root fields and an alias', async () => {
      var query = `
        query FetchLukeAndLeiaAliased {
          luke: human(id: "1000") {
            name
          }
          leia: human(id: "1003") {
            name
          }
        }
      `;
      var expected = {
        luke: {
          name: 'Luke Skywalker'
        },
        leia: {
          name: 'Leia Organa'
        }
      };
      var result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });
  });

  describe('Uses fragments to express more complex queries', () => {
    it('Allows us to query using duplicated content', async () => {
      var query = `
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
      var expected = {
        luke: {
          name: 'Luke Skywalker',
          homePlanet: 'Tatooine'
        },
        leia: {
          name: 'Leia Organa',
          homePlanet: 'Alderaan'
        }
      };
      var result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows us to use a fragment to avoid duplicating content', async () => {
      var query = `
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
      var expected = {
        luke: {
          name: 'Luke Skywalker',
          homePlanet: 'Tatooine'
        },
        leia: {
          name: 'Leia Organa',
          homePlanet: 'Alderaan'
        }
      };
      var result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });
  });

  describe('Using __typename to find the type of an object', () => {
    it('Allows us to verify that R2-D2 is a droid', async () => {
      var query = `
        query CheckTypeOfR2 {
          hero {
            __typename
            name
          }
        }
      `;
      var expected = {
        hero: {
          __typename: 'Droid',
          name: 'R2-D2'
        },
      };
      var result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows us to verify that Luke is a human', async () => {
      var query = `
        query CheckTypeOfLuke {
          hero(episode: EMPIRE) {
            __typename
            name
          }
        }
      `;
      var expected = {
        hero: {
          __typename: 'Human',
          name: 'Luke Skywalker'
        },
      };
      var result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });
  });
});
