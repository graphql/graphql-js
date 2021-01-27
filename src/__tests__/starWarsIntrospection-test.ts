import { expect } from 'chai';
import { describe, it } from 'mocha';

import { graphqlSync } from '../graphql';

import { StarWarsSchema } from './starWarsSchema';

function queryStarWars(source: string) {
  const result = graphqlSync({ schema: StarWarsSchema, source });
  expect(Object.keys(result)).to.deep.equal(['data']);
  return result.data;
}

describe('Star Wars Introspection Tests', () => {
  describe('Basic Introspection', () => {
    it('Allows querying the schema for types', () => {
      const data = queryStarWars(`
        {
          __schema {
            types {
              name
            }
          }
        }
      `);

      // Include all types used by StarWars schema, introspection types and
      // standard directives. For example, `Boolean` is used in `@skip`,
      // `@include` and also inside introspection types.
      expect(data).to.deep.equal({
        __schema: {
          types: [
            { name: 'Human' },
            { name: 'Character' },
            { name: 'String' },
            { name: 'Episode' },
            { name: 'Droid' },
            { name: 'Query' },
            { name: 'Boolean' },
            { name: '__Schema' },
            { name: '__Type' },
            { name: '__TypeKind' },
            { name: '__Field' },
            { name: '__InputValue' },
            { name: '__EnumValue' },
            { name: '__Directive' },
            { name: '__DirectiveLocation' },
          ],
        },
      });
    });

    it('Allows querying the schema for query type', () => {
      const data = queryStarWars(`
        {
          __schema {
            queryType {
              name
            }
          }
        }
      `);

      expect(data).to.deep.equal({
        __schema: {
          queryType: {
            name: 'Query',
          },
        },
      });
    });

    it('Allows querying the schema for a specific type', () => {
      const data = queryStarWars(`
        {
          __type(name: "Droid") {
            name
          }
        }
      `);

      expect(data).to.deep.equal({
        __type: {
          name: 'Droid',
        },
      });
    });

    it('Allows querying the schema for an object kind', () => {
      const data = queryStarWars(`
        {
          __type(name: "Droid") {
            name
            kind
          }
        }
      `);

      expect(data).to.deep.equal({
        __type: {
          name: 'Droid',
          kind: 'OBJECT',
        },
      });
    });

    it('Allows querying the schema for an interface kind', () => {
      const data = queryStarWars(`
        {
          __type(name: "Character") {
            name
            kind
          }
        }
      `);

      expect(data).to.deep.equal({
        __type: {
          name: 'Character',
          kind: 'INTERFACE',
        },
      });
    });

    it('Allows querying the schema for object fields', () => {
      const data = queryStarWars(`
        {
          __type(name: "Droid") {
            name
            fields {
              name
              type {
                name
                kind
              }
            }
          }
        }
      `);

      expect(data).to.deep.equal({
        __type: {
          name: 'Droid',
          fields: [
            {
              name: 'id',
              type: { name: null, kind: 'NON_NULL' },
            },
            {
              name: 'name',
              type: { name: 'String', kind: 'SCALAR' },
            },
            {
              name: 'friends',
              type: { name: null, kind: 'LIST' },
            },
            {
              name: 'appearsIn',
              type: { name: null, kind: 'LIST' },
            },
            {
              name: 'secretBackstory',
              type: { name: 'String', kind: 'SCALAR' },
            },
            {
              name: 'primaryFunction',
              type: { name: 'String', kind: 'SCALAR' },
            },
          ],
        },
      });
    });

    it('Allows querying the schema for nested object fields', () => {
      const data = queryStarWars(`
        {
          __type(name: "Droid") {
            name
            fields {
              name
              type {
                name
                kind
                ofType {
                  name
                  kind
                }
              }
            }
          }
        }
      `);

      expect(data).to.deep.equal({
        __type: {
          name: 'Droid',
          fields: [
            {
              name: 'id',
              type: {
                name: null,
                kind: 'NON_NULL',
                ofType: {
                  name: 'String',
                  kind: 'SCALAR',
                },
              },
            },
            {
              name: 'name',
              type: {
                name: 'String',
                kind: 'SCALAR',
                ofType: null,
              },
            },
            {
              name: 'friends',
              type: {
                name: null,
                kind: 'LIST',
                ofType: {
                  name: 'Character',
                  kind: 'INTERFACE',
                },
              },
            },
            {
              name: 'appearsIn',
              type: {
                name: null,
                kind: 'LIST',
                ofType: {
                  name: 'Episode',
                  kind: 'ENUM',
                },
              },
            },
            {
              name: 'secretBackstory',
              type: {
                name: 'String',
                kind: 'SCALAR',
                ofType: null,
              },
            },
            {
              name: 'primaryFunction',
              type: {
                name: 'String',
                kind: 'SCALAR',
                ofType: null,
              },
            },
          ],
        },
      });
    });

    it('Allows querying the schema for field args', () => {
      const data = queryStarWars(`
        {
          __schema {
            queryType {
              fields {
                name
                args {
                  name
                  description
                  type {
                    name
                    kind
                    ofType {
                      name
                      kind
                    }
                  }
                  defaultValue
                }
              }
            }
          }
        }
      `);

      expect(data).to.deep.equal({
        __schema: {
          queryType: {
            fields: [
              {
                name: 'hero',
                args: [
                  {
                    defaultValue: null,
                    description:
                      'If omitted, returns the hero of the whole saga. If provided, returns the hero of that particular episode.',
                    name: 'episode',
                    type: {
                      kind: 'ENUM',
                      name: 'Episode',
                      ofType: null,
                    },
                  },
                ],
              },
              {
                name: 'human',
                args: [
                  {
                    name: 'id',
                    description: 'id of the human',
                    type: {
                      kind: 'NON_NULL',
                      name: null,
                      ofType: {
                        kind: 'SCALAR',
                        name: 'String',
                      },
                    },
                    defaultValue: null,
                  },
                ],
              },
              {
                name: 'droid',
                args: [
                  {
                    name: 'id',
                    description: 'id of the droid',
                    type: {
                      kind: 'NON_NULL',
                      name: null,
                      ofType: {
                        kind: 'SCALAR',
                        name: 'String',
                      },
                    },
                    defaultValue: null,
                  },
                ],
              },
            ],
          },
        },
      });
    });

    it('Allows querying the schema for documentation', () => {
      const data = queryStarWars(`
        {
          __type(name: "Droid") {
            name
            description
          }
        }
      `);

      expect(data).to.deep.equal({
        __type: {
          name: 'Droid',
          description: 'A mechanical creature in the Star Wars universe.',
        },
      });
    });
  });
});
