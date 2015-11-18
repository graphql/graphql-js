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

import {
  missingFieldArgMessage
} from '../../validation/rules/ProvidedNonNullArguments';
import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLList,
  GraphQLInputObjectType,
  GraphQLString,
  GraphQLJson,
  GraphQLEnumType,
} from '../../';

import { introspectionQuery } from '../../utilities/introspectionQuery';

describe('Introspection', () => {
  it('executes an introspection query', async () => {
    var EmptySchema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'QueryRoot',
        fields: {
          onlyField: { type: GraphQLString }
        }
      })
    });

    return expect(
      await graphql(EmptySchema, introspectionQuery)
    ).to.containSubset({
      data: {
        __schema: {
          mutationType: null,
          subscriptionType: null,
          queryType: {
            name: 'QueryRoot',
          },
          types: [
            {
              kind: 'OBJECT',
              name: 'QueryRoot',
              inputFields: null,
              interfaces: [],
              enumValues: null,
              possibleTypes: null,
            },
            {
              kind: 'OBJECT',
              name: '__Schema',
              fields: [
                {
                  name: 'types',
                  args: [],
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'LIST',
                      name: null,
                      ofType: {
                        kind: 'NON_NULL',
                        name: null,
                        ofType: {
                          kind: 'OBJECT',
                          name: '__Type'
                        }
                      }
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'queryType',
                  args: [],
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'OBJECT',
                      name: '__Type',
                      ofType: null
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'mutationType',
                  args: [],
                  type: {
                    kind: 'OBJECT',
                    name: '__Type',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'subscriptionType',
                  args: [],
                  type: {
                    kind: 'OBJECT',
                    name: '__Type',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'directives',
                  args: [],
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'LIST',
                      name: null,
                      ofType: {
                        kind: 'NON_NULL',
                        name: null,
                        ofType: {
                          kind: 'OBJECT',
                          name: '__Directive'
                        }
                      }
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                }
              ],
              inputFields: null,
              interfaces: [],
              enumValues: null,
              possibleTypes: null,
            },
            {
              kind: 'OBJECT',
              name: '__Type',
              fields: [
                {
                  name: 'kind',
                  args: [],
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'ENUM',
                      name: '__TypeKind',
                      ofType: null
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'name',
                  args: [],
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'description',
                  args: [],
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'fields',
                  args: [
                    {
                      name: 'includeDeprecated',
                      type: {
                        kind: 'SCALAR',
                        name: 'Boolean',
                        ofType: null
                      },
                      defaultValue: 'false'
                    }
                  ],
                  type: {
                    kind: 'LIST',
                    name: null,
                    ofType: {
                      kind: 'NON_NULL',
                      name: null,
                      ofType: {
                        kind: 'OBJECT',
                        name: '__Field',
                        ofType: null
                      }
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'interfaces',
                  args: [],
                  type: {
                    kind: 'LIST',
                    name: null,
                    ofType: {
                      kind: 'NON_NULL',
                      name: null,
                      ofType: {
                        kind: 'OBJECT',
                        name: '__Type',
                        ofType: null
                      }
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'possibleTypes',
                  args: [],
                  type: {
                    kind: 'LIST',
                    name: null,
                    ofType: {
                      kind: 'NON_NULL',
                      name: null,
                      ofType: {
                        kind: 'OBJECT',
                        name: '__Type',
                        ofType: null
                      }
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'enumValues',
                  args: [
                    {
                      name: 'includeDeprecated',
                      type: {
                        kind: 'SCALAR',
                        name: 'Boolean',
                        ofType: null
                      },
                      defaultValue: 'false'
                    }
                  ],
                  type: {
                    kind: 'LIST',
                    name: null,
                    ofType: {
                      kind: 'NON_NULL',
                      name: null,
                      ofType: {
                        kind: 'OBJECT',
                        name: '__EnumValue',
                        ofType: null
                      }
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'inputFields',
                  args: [],
                  type: {
                    kind: 'LIST',
                    name: null,
                    ofType: {
                      kind: 'NON_NULL',
                      name: null,
                      ofType: {
                        kind: 'OBJECT',
                        name: '__InputValue',
                        ofType: null
                      }
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'ofType',
                  args: [],
                  type: {
                    kind: 'OBJECT',
                    name: '__Type',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                }
              ],
              inputFields: null,
              interfaces: [],
              enumValues: null,
              possibleTypes: null,
            },
            {
              kind: 'ENUM',
              name: '__TypeKind',
              fields: null,
              inputFields: null,
              interfaces: null,
              enumValues: [
                {
                  name: 'SCALAR',
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'OBJECT',
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'INTERFACE',
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'UNION',
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'ENUM',
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'INPUT_OBJECT',
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'LIST',
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'NON_NULL',
                  isDeprecated: false,
                  deprecationReason: null
                }
              ],
              possibleTypes: null,
            },
            {
              kind: 'SCALAR',
              name: 'String',
              fields: null,
              inputFields: null,
              interfaces: null,
              enumValues: null,
              possibleTypes: null,
            },
            {
              kind: 'SCALAR',
              name: 'Boolean',
              fields: null,
              inputFields: null,
              interfaces: null,
              enumValues: null,
              possibleTypes: null,
            },
            {
              kind: 'OBJECT',
              name: '__Field',
              fields: [
                {
                  name: 'name',
                  args: [],
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'SCALAR',
                      name: 'String',
                      ofType: null
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'description',
                  args: [],
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'args',
                  args: [],
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'LIST',
                      name: null,
                      ofType: {
                        kind: 'NON_NULL',
                        name: null,
                        ofType: {
                          kind: 'OBJECT',
                          name: '__InputValue'
                        }
                      }
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'type',
                  args: [],
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'OBJECT',
                      name: '__Type',
                      ofType: null
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'isDeprecated',
                  args: [],
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'SCALAR',
                      name: 'Boolean',
                      ofType: null
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'deprecationReason',
                  args: [],
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                }
              ],
              inputFields: null,
              interfaces: [],
              enumValues: null,
              possibleTypes: null,
            },
            {
              kind: 'OBJECT',
              name: '__InputValue',
              fields: [
                {
                  name: 'name',
                  args: [],
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'SCALAR',
                      name: 'String',
                      ofType: null
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'description',
                  args: [],
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'type',
                  args: [],
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'OBJECT',
                      name: '__Type',
                      ofType: null
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'defaultValue',
                  args: [],
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                }
              ],
              inputFields: null,
              interfaces: [],
              enumValues: null,
              possibleTypes: null,
            },
            {
              kind: 'OBJECT',
              name: '__EnumValue',
              fields: [
                {
                  name: 'name',
                  args: [],
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'SCALAR',
                      name: 'String',
                      ofType: null
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'description',
                  args: [],
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'isDeprecated',
                  args: [],
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'SCALAR',
                      name: 'Boolean',
                      ofType: null
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'deprecationReason',
                  args: [],
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                }
              ],
              inputFields: null,
              interfaces: [],
              enumValues: null,
              possibleTypes: null,
            },
            {
              kind: 'OBJECT',
              name: '__Directive',
              fields: [
                {
                  name: 'name',
                  args: [],
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'SCALAR',
                      name: 'String',
                      ofType: null
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'description',
                  args: [],
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'args',
                  args: [],
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'LIST',
                      name: null,
                      ofType: {
                        kind: 'NON_NULL',
                        name: null,
                        ofType: {
                          kind: 'OBJECT',
                          name: '__InputValue'
                        }
                      }
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'onOperation',
                  args: [],
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'SCALAR',
                      name: 'Boolean',
                      ofType: null,
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'onFragment',
                  args: [],
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'SCALAR',
                      name: 'Boolean',
                      ofType: null,
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  name: 'onField',
                  args: [],
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'SCALAR',
                      name: 'Boolean',
                      ofType: null,
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null
                }
              ],
              inputFields: null,
              interfaces: [],
              enumValues: null,
              possibleTypes: null,
            }
          ],
          directives: [
            {
              name: 'include',
              args: [
                {
                  defaultValue: null,
                  name: 'if',
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'SCALAR',
                      name: 'Boolean',
                      ofType: null
                    }
                  }
                }
              ],
              onOperation: false,
              onFragment: true,
              onField: true
            },
            {
              name: 'skip',
              args: [
                {
                  defaultValue: null,
                  name: 'if',
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'SCALAR',
                      name: 'Boolean',
                      ofType: null
                    }
                  }
                }
              ],
              onOperation: false,
              onFragment: true,
              onField: true
            }
          ]
        }
      }
    });
  });

  it('introspects on input object', async () => {

    var TestInputObject = new GraphQLInputObjectType({
      name: 'TestInputObject',
      fields: {
        a: { type: GraphQLString, defaultValue: 'foo' },
        b: { type: new GraphQLList(GraphQLString) }
      }
    });

    var TestType = new GraphQLObjectType({
      name: 'TestType',
      fields: {
        field: {
          type: GraphQLString,
          args: { complex: { type: TestInputObject } },
          resolve: (_, { complex }) => JSON.stringify(complex)
        }
      }
    });

    var schema = new GraphQLSchema({ query: TestType });
    var request = `
      {
        __schema {
          types {
            kind
            name
            inputFields {
              name
              type { ...TypeRef }
              defaultValue
            }
          }
        }
      }

      fragment TypeRef on __Type {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
            }
          }
        }
      }
    `;

    return expect(
      await graphql(schema, request)
    ).to.containSubset({
      data:
       { __schema:
          { types:
             [ { kind: 'INPUT_OBJECT',
                 name: 'TestInputObject',
                 inputFields:
                  [ { name: 'a',
                      type:
                       { kind: 'SCALAR',
                         name: 'String',
                         ofType: null },
                      defaultValue: '"foo"' },
                    { name: 'b',
                      type:
                       { kind: 'LIST',
                         name: null,
                         ofType:
                          { kind: 'SCALAR',
                            name: 'String',
                            ofType: null } },
                      defaultValue: null } ] } ] } }
    });
  });

  it('supports the __type root field', async () => {
    var TestType = new GraphQLObjectType({
      name: 'TestType',
      fields: {
        testField: {
          type: GraphQLString,
        }
      }
    });

    var schema = new GraphQLSchema({ query: TestType });
    var request = `
      {
        __type(name: "TestType") {
          name
        }
      }
    `;

    return expect(
      await graphql(schema, request)
    ).to.deep.equal({
      data: {
        __type: {
          name: 'TestType'
        }
      }
    });
  });

  it('identifies deprecated fields', async () => {

    var TestType = new GraphQLObjectType({
      name: 'TestType',
      fields: {
        nonDeprecated: {
          type: GraphQLString,
        },
        deprecated: {
          type: GraphQLString,
          deprecationReason: 'Removed in 1.0'
        }
      }
    });

    var schema = new GraphQLSchema({ query: TestType });
    var request = `
      {
        __type(name: "TestType") {
          name
          fields(includeDeprecated: true) {
            name
            isDeprecated,
            deprecationReason
          }
        }
      }
    `;

    return expect(
      await graphql(schema, request)
    ).to.deep.equal({
      data: {
        __type: {
          name: 'TestType',
          fields: [
            {
              name: 'nonDeprecated',
              isDeprecated: false,
              deprecationReason: null
            },
            {
              name: 'deprecated',
              isDeprecated: true,
              deprecationReason: 'Removed in 1.0'
            }
          ]
        }
      }
    });
  });

  it('respects the includeDeprecated parameter for fields', async () => {

    var TestType = new GraphQLObjectType({
      name: 'TestType',
      fields: {
        nonDeprecated: {
          type: GraphQLString,
        },
        deprecated: {
          type: GraphQLString,
          deprecationReason: 'Removed in 1.0'
        }
      }
    });

    var schema = new GraphQLSchema({ query: TestType });
    var request = `
      {
        __type(name: "TestType") {
          name
          trueFields: fields(includeDeprecated: true) {
            name
          }
          falseFields: fields(includeDeprecated: false) {
            name
          }
          omittedFields: fields {
            name
          }
        }
      }
    `;

    return expect(
      await graphql(schema, request)
    ).to.deep.equal({
      data: {
        __type: {
          name: 'TestType',
          trueFields: [
            {
              name: 'nonDeprecated',
            },
            {
              name: 'deprecated',
            }
          ],
          falseFields: [
            {
              name: 'nonDeprecated',
            }
          ],
          omittedFields: [
            {
              name: 'nonDeprecated',
            }
          ],
        }
      }
    });
  });

  it('identifies deprecated enum values', async () => {

    var TestEnum = new GraphQLEnumType({
      name: 'TestEnum',
      values: {
        NONDEPRECATED: { value: 0 },
        DEPRECATED: { value: 1, deprecationReason: 'Removed in 1.0' },
        ALSONONDEPRECATED: { value: 2 }
      }
    });

    var TestType = new GraphQLObjectType({
      name: 'TestType',
      fields: {
        testEnum: {
          type: TestEnum,
        },
      }
    });

    var schema = new GraphQLSchema({ query: TestType });
    var request = `
      {
        __type(name: "TestEnum") {
          name
          enumValues(includeDeprecated: true) {
            name
            isDeprecated,
            deprecationReason
          }
        }
      }
    `;

    return expect(
      await graphql(schema, request)
    ).to.deep.equal({
      data: {
        __type: {
          name: 'TestEnum',
          enumValues: [
            {
              name: 'NONDEPRECATED',
              isDeprecated: false,
              deprecationReason: null
            },
            {
              name: 'DEPRECATED',
              isDeprecated: true,
              deprecationReason: 'Removed in 1.0'
            },
            {
              name: 'ALSONONDEPRECATED',
              isDeprecated: false,
              deprecationReason: null
            }
          ]
        }
      }
    });
  });

  it('respects the includeDeprecated parameter for enum values', async () => {

    var TestEnum = new GraphQLEnumType({
      name: 'TestEnum',
      values: {
        NONDEPRECATED: { value: 0 },
        DEPRECATED: { value: 1, deprecationReason: 'Removed in 1.0' },
        ALSONONDEPRECATED: { value: 2 }
      }
    });

    var TestType = new GraphQLObjectType({
      name: 'TestType',
      fields: {
        testEnum: {
          type: TestEnum,
        },
      }
    });

    var schema = new GraphQLSchema({ query: TestType });
    var request = `
      {
        __type(name: "TestEnum") {
          name
          trueValues: enumValues(includeDeprecated: true) {
            name
          }
          falseValues: enumValues(includeDeprecated: false) {
            name
          }
          omittedValues: enumValues {
            name
          }
        }
      }
    `;

    return expect(
      await graphql(schema, request)
    ).to.deep.equal({
      data: {
        __type: {
          name: 'TestEnum',
          trueValues: [
            {
              name: 'NONDEPRECATED',
            },
            {
              name: 'DEPRECATED',
            },
            {
              name: 'ALSONONDEPRECATED',
            }
          ],
          falseValues: [
            {
              name: 'NONDEPRECATED',
            },
            {
              name: 'ALSONONDEPRECATED',
            }
          ],
          omittedValues: [
            {
              name: 'NONDEPRECATED',
            },
            {
              name: 'ALSONONDEPRECATED',
            }
          ],
        }
      }
    });
  });

  it('fails as expected on the __type root field without an arg', async () => {
    var TestType = new GraphQLObjectType({
      name: 'TestType',
      fields: {
        testField: {
          type: GraphQLString,
        }
      }
    });

    var schema = new GraphQLSchema({ query: TestType });
    var request = `
      {
        __type {
          name
        }
      }
    `;

    return expect(
      await graphql(schema, request)
    ).to.containSubset({
      errors: [
        { message: missingFieldArgMessage('__type', 'name', 'String!'),
          locations: [ { line: 3, column: 9 } ] }
      ]
    });
  });

  it('exposes descriptions on types and fields', async () => {
    var QueryRoot = new GraphQLObjectType({
      name: 'QueryRoot',
      fields: {
        onlyField: { type: GraphQLString }
      }
    });

    var schema = new GraphQLSchema({ query: QueryRoot });
    var request = `
      {
        schemaType: __type(name: "__Schema") {
          name,
          description,
          fields {
            name,
            description
          }
        }
      }
    `;

    return expect(
      await graphql(schema, request)
    ).to.deep.equal({
      data: {
        schemaType: {
          name: '__Schema',
          description: 'A GraphQL Schema defines the capabilities of a ' +
                       'GraphQL server. It exposes all available types and ' +
                       'directives on the server, as well as the entry ' +
                       'points for query, mutation, ' +
                       'and subscription operations.',
          fields: [
            {
              name: 'types',
              description: 'A list of all types supported by this server.'
            },
            {
              name: 'queryType',
              description: 'The type that query operations will be rooted at.'
            },
            {
              name: 'mutationType',
              description: 'If this server supports mutation, the type that ' +
                           'mutation operations will be rooted at.'
            },
            {
              name: 'subscriptionType',
              description: 'If this server support subscription, the type ' +
                           'that subscription operations will be rooted at.',
            },
            {
              name: 'directives',
              description: 'A list of all directives supported by this server.'
            }
          ]
        }
      }
    });
  });

  it('exposes descriptions on enums', async () => {
    var QueryRoot = new GraphQLObjectType({
      name: 'QueryRoot',
      fields: {
        onlyField: { type: GraphQLString }
      }
    });

    var schema = new GraphQLSchema({ query: QueryRoot });
    var request = `
      {
        typeKindType: __type(name: "__TypeKind") {
          name,
          description,
          enumValues {
            name,
            description
          }
        }
      }
    `;

    return expect(
      await graphql(schema, request)
    ).to.deep.equal({
      data: {
        typeKindType: {
          name: '__TypeKind',
          description:
            'An enum describing what kind of type a given `__Type` is.',
          enumValues: [
            {
              description: 'Indicates this type is a scalar.',
              name: 'SCALAR'
            },
            {
              description: 'Indicates this type is an object. ' +
                           '`fields` and `interfaces` are valid fields.',
              name: 'OBJECT'
            },
            {
              description: 'Indicates this type is an interface. ' +
                           '`fields` and `possibleTypes` are valid fields.',
              name: 'INTERFACE'
            },
            {
              description: 'Indicates this type is a union. ' +
                           '`possibleTypes` is a valid field.',
              name: 'UNION'
            },
            {
              description: 'Indicates this type is an enum. ' +
                           '`enumValues` is a valid field.',
              name: 'ENUM'
            },
            {
              description: 'Indicates this type is an input object. ' +
                           '`inputFields` is a valid field.',
              name: 'INPUT_OBJECT'
            },
            {
              description: 'Indicates this type is a list. ' +
                           '`ofType` is a valid field.',
              name: 'LIST'
            },
            {
              description: 'Indicates this type is a non-null. ' +
                           '`ofType` is a valid field.',
              name: 'NON_NULL'
            }
          ]
        }
      }
    });
  });

  describe('JSON type', async () => {
    // Schema that provide the argument as a value
    var JsonWithArgRoot = new GraphQLObjectType({
      name: 'JsonWithArgRoot',
      fields: {
        jsonField: {
          type: GraphQLJson,
          args: {
            jsonArg: {
              type: GraphQLJson
            }
          },
          resolve(_, args) {
            return args.jsonArg;
          }
        }
      }
    });
    it('Resolve Type with JSON field', async () => {

      var ObjectType = new GraphQLObjectType({
        name: 'ObjectType',
        fields: {
          key: {
            type: GraphQLString,
          },
          name: {
            type: GraphQLString,
          },
          config: {
            type: GraphQLJson,
          }
        }
      });
      var QueryRoot = new GraphQLObjectType({
        name: 'QueryRoot',
        fields: {
          object: {
            type: ObjectType,
            resolve() {
              return {
                key: 'ffff-acde-876678',
                name: 'Object Name',
                config: {
                  key1: 1,
                  key2: 'value1',
                  key3: [ 1, '2', true ]
                }
              };
            }
          }
        }
      });

      var schema = new GraphQLSchema({ query: QueryRoot });
      var request = `
        {
          object {
            key,
            name,
            config
          }
        }
      `;

      return expect(
        await graphql(schema, request)
      ).to.deep.equal({
        data: {
          object: {
            key: 'ffff-acde-876678',
            name: 'Object Name',
            config: {
              key1: 1,
              key2: 'value1',
              key3: [ 1, '2', true ]
            }
          }
        }
      });
    });

    it('Arguments with String value', async () => {

      var schema = new GraphQLSchema({ query: JsonWithArgRoot });
      var request = `
        {
          jsonField(jsonArg: "arg string")
        }
      `;

      return expect(
        await graphql(schema, request)
      ).to.deep.equal({
        data: {
          jsonField: 'arg string'
        }
      });
    });
    it('Arguments with Int value', async () => {

      var schema = new GraphQLSchema({ query: JsonWithArgRoot });
      var request = `
        {
          jsonField(jsonArg: 127)
        }
      `;

      return expect(
        await graphql(schema, request)
      ).to.deep.equal({
        data: {
          jsonField: 127
        }
      });
    });
    it('Arguments with Float value', async () => {

      var schema = new GraphQLSchema({ query: JsonWithArgRoot });
      var request = `
        {
          jsonField(jsonArg: 3.14155962)
        }
      `;

      return expect(
        await graphql(schema, request)
      ).to.deep.equal({
        data: {
          jsonField: 3.14155962
        }
      });
    });
    it('Arguments with Boolean value', async () => {

      var schema = new GraphQLSchema({ query: JsonWithArgRoot });
      var request = `
        {
          jsonField(jsonArg: true)
        }
      `;

      return expect(
        await graphql(schema, request)
      ).to.deep.equal({
        data: {
          jsonField: true
        }
      });
    });
    it('Arguments with Enum value', async () => {

      var schema = new GraphQLSchema({ query: JsonWithArgRoot });
      var request = `
        {
          jsonField(jsonArg: SOME_ENUM)
        }
      `;

      return expect(
        await graphql(schema, request)
      ).to.deep.equal({
        data: {
          jsonField: 'SOME_ENUM'
        }
      });
    });
    it('Arguments with Array value', async () => {

      var schema = new GraphQLSchema({ query: JsonWithArgRoot });
      var request = `
        {
          jsonField(jsonArg: [ 1, 2, 3 ])
        }
      `;

      return expect(
        await graphql(schema, request)
      ).to.deep.equal({
        data: {
          jsonField: [ 1, 2, 3 ]
        }
      });
    });
    it('Arguments with Object value', async () => {

      var schema = new GraphQLSchema({ query: JsonWithArgRoot });
      var request = `
        {
          jsonField(jsonArg: {
            stringValue: "some string"
            arrayValue: [ 1, 2, 3 ]
          })
        }
      `;

      return expect(
        await graphql(schema, request)
      ).to.deep.equal({
        data: {
          jsonField: {
            stringValue: 'some string',
            arrayValue: [ 1, 2, 3 ]
          }
        }
      });
    });
    it('Arguments with null value', async () => {

      var schema = new GraphQLSchema({ query: JsonWithArgRoot });
      var request = `
        {
          jsonField
        }
      `;

      return expect(
        await graphql(schema, request)
      ).to.deep.equal({
        data: {
          jsonField: null
        }
      });
    });
  });
});
