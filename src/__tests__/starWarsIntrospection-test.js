/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { StarWarsSchema } from './starWarsSchema';
import { graphqlSync } from '../graphql';

describe('Star Wars Introspection Tests', () => {
  describe('Basic Introspection', () => {
    it('Allows querying the schema for types', () => {
      const query = `
        query IntrospectionTypeQuery {
          __schema {
            types {
              name
            }
          }
        }
      `;
      const expected = {
        __schema: {
          types: [
            {
              name: 'Query',
            },
            {
              name: 'Episode',
            },
            {
              name: 'Character',
            },
            {
              name: 'String',
            },
            {
              name: 'Human',
            },
            {
              name: 'Droid',
            },
            {
              name: '__Schema',
            },
            {
              name: '__Type',
            },
            {
              name: '__TypeKind',
            },
            {
              name: 'Boolean',
            },
            {
              name: '__Field',
            },
            {
              name: '__InputValue',
            },
            {
              name: '__EnumValue',
            },
            {
              name: '__Directive',
            },
            {
              name: '__DirectiveLocation',
            },
          ],
        },
      };
      const result = graphqlSync(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows querying the schema for query type', () => {
      const query = `
        query IntrospectionQueryTypeQuery {
          __schema {
            queryType {
              name
            }
          }
        }
      `;
      const expected = {
        __schema: {
          queryType: {
            name: 'Query',
          },
        },
      };
      const result = graphqlSync(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows querying the schema for a specific type', () => {
      const query = `
        query IntrospectionDroidTypeQuery {
          __type(name: "Droid") {
            name
          }
        }
      `;
      const expected = {
        __type: {
          name: 'Droid',
        },
      };
      const result = graphqlSync(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows querying the schema for an object kind', () => {
      const query = `
        query IntrospectionDroidKindQuery {
          __type(name: "Droid") {
            name
            kind
          }
        }
      `;
      const expected = {
        __type: {
          name: 'Droid',
          kind: 'OBJECT',
        },
      };
      const result = graphqlSync(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows querying the schema for an interface kind', () => {
      const query = `
        query IntrospectionCharacterKindQuery {
          __type(name: "Character") {
            name
            kind
          }
        }
      `;
      const expected = {
        __type: {
          name: 'Character',
          kind: 'INTERFACE',
        },
      };
      const result = graphqlSync(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows querying the schema for object fields', () => {
      const query = `
        query IntrospectionDroidFieldsQuery {
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
      `;
      const expected = {
        __type: {
          name: 'Droid',
          fields: [
            {
              name: 'id',
              type: {
                name: null,
                kind: 'NON_NULL',
              },
            },
            {
              name: 'name',
              type: {
                name: 'String',
                kind: 'SCALAR',
              },
            },
            {
              name: 'friends',
              type: {
                name: null,
                kind: 'LIST',
              },
            },
            {
              name: 'appearsIn',
              type: {
                name: null,
                kind: 'LIST',
              },
            },
            {
              name: 'secretBackstory',
              type: {
                name: 'String',
                kind: 'SCALAR',
              },
            },
            {
              name: 'primaryFunction',
              type: {
                name: 'String',
                kind: 'SCALAR',
              },
            },
          ],
        },
      };

      const result = graphqlSync(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows querying the schema for nested object fields', () => {
      const query = `
        query IntrospectionDroidNestedFieldsQuery {
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
      `;
      const expected = {
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
      };
      const result = graphqlSync(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows querying the schema for field args', () => {
      const query = `
        query IntrospectionQueryTypeQuery {
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
      `;
      const expected = {
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
      };

      const result = graphqlSync(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows querying the schema for documentation', () => {
      const query = `
        query IntrospectionDroidDescriptionQuery {
          __type(name: "Droid") {
            name
            description
          }
        }
      `;
      const expected = {
        __type: {
          name: 'Droid',
          description: 'A mechanical creature in the Star Wars universe.',
        },
      };
      const result = graphqlSync(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });
  });
});
