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

describe('Star Wars Introspection Tests', () => {
  describe('Basic Introspection', () => {
    it('Allows querying the schema for types', async () => {
      var query = `
        query IntrospectionTypeQuery {
          __schema {
            types {
              name
            }
          }
        }
      `;
      var expected = {
        __schema: {
          types: [
            {
              name: 'Query'
            },
            {
              name: 'Episode'
            },
            {
              name: 'Character'
            },
            {
              name: 'Human'
            },
            {
              name: 'String'
            },
            {
              name: 'Droid'
            },
            {
              name: '__Schema'
            },
            {
              name: '__Type'
            },
            {
              name: '__TypeKind'
            },
            {
              name: 'Boolean'
            },
            {
              name: '__Field'
            },
            {
              name: '__InputValue'
            },
            {
              name: '__Annotation'
            },
            {
              name: '__AnnotationArgument'
            },
            {
              name: '__EnumValue'
            },
            {
              name: '__Directive'
            }
          ]
        }
      };
      var result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows querying the schema for query type', async () => {
      var query = `
        query IntrospectionQueryTypeQuery {
          __schema {
            queryType {
              name
            }
          }
        }
      `;
      var expected = {
        __schema: {
          queryType: {
            name: 'Query'
          },
        }
      };
      var result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows querying the schema for a specific type', async () => {
      var query = `
        query IntrospectionDroidTypeQuery {
          __type(name: "Droid") {
            name
          }
        }
      `;
      var expected = {
        __type: {
          name: 'Droid'
        }
      };
      var result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows querying the schema for an object kind', async () => {
      var query = `
        query IntrospectionDroidKindQuery {
          __type(name: "Droid") {
            name
            kind
          }
        }
      `;
      var expected = {
        __type: {
          name: 'Droid',
          kind: 'OBJECT'
        }
      };
      var result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows querying the schema for an interface kind', async () => {
      var query = `
        query IntrospectionCharacterKindQuery {
          __type(name: "Character") {
            name
            kind
          }
        }
      `;
      var expected = {
        __type: {
          name: 'Character',
          kind: 'INTERFACE'
        }
      };
      var result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows querying the schema for object fields', async () => {
      var query = `
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
      var expected = {
        __type: {
          name: 'Droid',
          fields: [
            {
              name: 'id',
              type: {
                name: null,
                kind: 'NON_NULL'
              }
            },
            {
              name: 'name',
              type: {
                name: 'String',
                kind: 'SCALAR'
              }
            },
            {
              name: 'friends',
              type: {
                name: null,
                kind: 'LIST'
              }
            },
            {
              name: 'appearsIn',
              type: {
                name: null,
                kind: 'LIST'
              }
            },
            {
              name: 'primaryFunction',
              type: {
                name: 'String',
                kind: 'SCALAR'
              }
            }
          ]
        }
      };

      var result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows querying the schema for nested object fields', async () => {
      var query = `
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
      var expected = {
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
                  kind: 'SCALAR'
                }
              }
            },
            {
              name: 'name',
              type: {
                name: 'String',
                kind: 'SCALAR',
                ofType: null
              }
            },
            {
              name: 'friends',
              type: {
                name: null,
                kind: 'LIST',
                ofType: {
                  name: 'Character',
                  kind: 'INTERFACE'
                }
              }
            },
            {
              name: 'appearsIn',
              type: {
                name: null,
                kind: 'LIST',
                ofType: {
                  name: 'Episode',
                  kind: 'ENUM'
                }
              }
            },
            {
              name: 'primaryFunction',
              type: {
                name: 'String',
                kind: 'SCALAR',
                ofType: null
              }
            }
          ]
        }
      };
      var result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows querying the schema for field args', async () => {
      var query = `
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
      var expected = {
        __schema: {
          queryType: {
            fields: [
              {
                name: 'hero',
                args: [
                  {
                    defaultValue: null,
                    description: 'If omitted, returns the hero of the whole ' +
                                 'saga. If provided, returns the hero of ' +
                                 'that particular episode.',
                    name: 'episode',
                    type: {
                      kind: 'ENUM',
                      name: 'Episode',
                      ofType: null
                    }
                  }
                ]
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
                        name: 'String'
                      }
                    },
                    defaultValue: null
                  }
                ]
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
                        name: 'String'
                      }
                    },
                    defaultValue: null
                  }
                ]
              }
            ]
          }
        }
      };


      var result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('Allows querying the schema for documentation', async () => {
      var query = `
        query IntrospectionDroidDescriptionQuery {
          __type(name: "Droid") {
            name
            description
          }
        }
      `;
      var expected = {
        __type: {
          name: 'Droid',
          description: 'A mechanical creature in the Star Wars universe.'
        }
      };
      var result = await graphql(StarWarsSchema, query);
      expect(result).to.deep.equal({ data: expected });
    });
  });
});
