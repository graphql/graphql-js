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
/*eslint-disable max-len */

/**
 * Helper function to test a query and the expected response.
 */
function testQuery(query, expected) {
  return expect(
    graphql(StarWarsSchema, query)
  ).to.become({data: expected});
}


describe('Star Wars Introspection Tests', () => {
  describe('Basic Introspection', () => {
    it('Allows querying the schema for types', () => {
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
              name: 'Character'
            },
            {
              name: 'Human'
            },
            {
              name: 'String'
            },
            {
              name: 'Episode'
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
              name: '__EnumValue'
            },
            {
              name: '__Directive'
            }
          ]
        }
      };
      return testQuery(query, expected);
    });

    it('Allows querying the schema for query type', () => {
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
      return testQuery(query, expected);
    });

    it('Allows querying the schema for a specific type', () => {
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
      return testQuery(query, expected);
    });

    it('Allows querying the schema for an object kind', () => {
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
      return testQuery(query, expected);
    });

    it('Allows querying the schema for an interface kind', () => {
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
      return testQuery(query, expected);
    });

    it('Allows querying the schema for object fields', () => {
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
      return testQuery(query, expected);
    });

    it('Allows querying the schema for nested object fields', () => {
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
      return testQuery(query, expected);
    });

    it('Allows querying the schema for documentation', () => {
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
      return testQuery(query, expected);
    });
  });
});
