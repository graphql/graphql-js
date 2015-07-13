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

import { missingFieldArgMessage } from '../../validator/errors';
import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLList,
  GraphQLInputObjectType,
  GraphQLString,
  GraphQLEnumType,
} from '../../';

import { introspectionQuery } from '../introspectionQuery';

describe('Introspection', () => {
  it('executes an introspection query', () => {
    var EmptySchema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'QueryRoot',
        fields: {}
      })
    });

    return expect(
      graphql(EmptySchema, introspectionQuery)
    ).to.become({
      data: {
        schemaType: {
          __typename: '__Type',
          enumValues: null,
          fields: [
            {
              __typename: '__Field',
              args: [],
              deprecationReason: null,
              isDeprecated: false,
              name: 'types',
              type: {
                __typename: '__Type',
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  __typename: '__Type',
                  kind: 'LIST',
                  name: null,
                  ofType: {
                    __typename: '__Type',
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      __typename: '__Type',
                      kind: 'OBJECT',
                      name: '__Type',
                    }
                  }
                }
              }
            },
            {
              __typename: '__Field',
              args: [],
              deprecationReason: null,
              isDeprecated: false,
              name: 'queryType',
              type: {
                __typename: '__Type',
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  __typename: '__Type',
                  kind: 'OBJECT',
                  name: '__Type',
                  ofType: null,
                },
              },
            },
            {
              __typename: '__Field',
              args: [],
              deprecationReason: null,
              isDeprecated: false,
              name: 'mutationType',
              type: {
                __typename: '__Type',
                kind: 'OBJECT',
                name: '__Type',
                ofType: null,
              },
            },
            {
              __typename: '__Field',
              args: [],
              deprecationReason: null,
              isDeprecated: false,
              name: 'directives',
              type: {
                __typename: '__Type',
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  __typename: '__Type',
                  kind: 'LIST',
                  name: null,
                  ofType: {
                    __typename: '__Type',
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      __typename: '__Type',
                      kind: 'OBJECT',
                      name: '__Directive',
                    },
                  },
                },
              },
            },
          ],
          interfaces: [],
          kind: 'OBJECT',
          name: '__Schema',
        },
        queryRootType: {
          __typename: '__Type',
          enumValues: null,
          fields: [],
          interfaces: [],
          kind: 'OBJECT',
          name: 'QueryRoot',
        },
        __schema: {
          __typename: '__Schema',
          types: [
            {
              __typename: '__Type',
              kind: 'OBJECT',
              name: 'QueryRoot',
              fields: [],
              interfaces: [],
              enumValues: null
            },
            {
              __typename: '__Type',
              kind: 'OBJECT',
              name: '__Schema',
              fields: [
                {
                  __typename: '__Field',
                  name: 'types',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      __typename: '__Type',
                      kind: 'LIST',
                      name: null,
                      ofType: {
                        __typename: '__Type',
                        kind: 'NON_NULL',
                        name: null,
                        ofType: {
                          __typename: '__Type',
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
                  __typename: '__Field',
                  name: 'queryType',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      __typename: '__Type',
                      kind: 'OBJECT',
                      name: '__Type',
                      ofType: null
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__Field',
                  name: 'mutationType',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'OBJECT',
                    name: '__Type',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__Field',
                  name: 'directives',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      __typename: '__Type',
                      kind: 'LIST',
                      name: null,
                      ofType: {
                        __typename: '__Type',
                        kind: 'NON_NULL',
                        name: null,
                        ofType: {
                          __typename: '__Type',
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
              interfaces: [],
              enumValues: null
            },
            {
              __typename: '__Type',
              kind: 'OBJECT',
              name: '__Type',
              fields: [
                {
                  __typename: '__Field',
                  name: 'kind',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      __typename: '__Type',
                      kind: 'ENUM',
                      name: '__TypeKind',
                      ofType: null
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__Field',
                  name: 'name',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__Field',
                  name: 'description',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__Field',
                  name: 'fields',
                  args: [
                    {
                      __typename: '__InputValue',
                      name: 'includeDeprecated',
                      type: {
                        __typename: '__Type',
                        kind: 'SCALAR',
                        name: 'Boolean',
                        ofType: null
                      },
                      defaultValue: 'false'
                    }
                  ],
                  type: {
                    __typename: '__Type',
                    kind: 'LIST',
                    name: null,
                    ofType: {
                      __typename: '__Type',
                      kind: 'NON_NULL',
                      name: null,
                      ofType: {
                        __typename: '__Type',
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
                  __typename: '__Field',
                  name: 'interfaces',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'LIST',
                    name: null,
                    ofType: {
                      __typename: '__Type',
                      kind: 'NON_NULL',
                      name: null,
                      ofType: {
                        __typename: '__Type',
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
                  __typename: '__Field',
                  name: 'possibleTypes',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'LIST',
                    name: null,
                    ofType: {
                      __typename: '__Type',
                      kind: 'NON_NULL',
                      name: null,
                      ofType: {
                        __typename: '__Type',
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
                  __typename: '__Field',
                  name: 'enumValues',
                  args: [
                    {
                      __typename: '__InputValue',
                      defaultValue: 'false',
                      name: 'includeDeprecated',
                      type: {
                        __typename: '__Type',
                        kind: 'SCALAR',
                        name: 'Boolean',
                        ofType: null
                      }
                    }
                  ],
                  type: {
                    __typename: '__Type',
                    kind: 'LIST',
                    name: null,
                    ofType: {
                      __typename: '__Type',
                      kind: 'NON_NULL',
                      name: null,
                      ofType: {
                        __typename: '__Type',
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
                  __typename: '__Field',
                  name: 'inputFields',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'LIST',
                    name: null,
                    ofType: {
                      __typename: '__Type',
                      kind: 'NON_NULL',
                      name: null,
                      ofType: {
                        __typename: '__Type',
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
                  __typename: '__Field',
                  name: 'ofType',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'OBJECT',
                    name: '__Type',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                }
              ],
              interfaces: [],
              enumValues: null
            },
            {
              __typename: '__Type',
              kind: 'ENUM',
              name: '__TypeKind',
              fields: null,
              interfaces: null,
              enumValues: [
                {
                  __typename: '__EnumValue',
                  name: 'SCALAR',
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__EnumValue',
                  name: 'OBJECT',
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__EnumValue',
                  name: 'INTERFACE',
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__EnumValue',
                  name: 'UNION',
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__EnumValue',
                  name: 'ENUM',
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__EnumValue',
                  name: 'INPUT_OBJECT',
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__EnumValue',
                  name: 'LIST',
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__EnumValue',
                  name: 'NON_NULL',
                  isDeprecated: false,
                  deprecationReason: null
                }
              ]
            },
            {
              __typename: '__Type',
              kind: 'SCALAR',
              name: 'String',
              fields: null,
              interfaces: null,
              enumValues: null
            },
            {
              __typename: '__Type',
              kind: 'SCALAR',
              name: 'Boolean',
              fields: null,
              interfaces: null,
              enumValues: null
            },
            {
              __typename: '__Type',
              kind: 'OBJECT',
              name: '__Field',
              fields: [
                {
                  __typename: '__Field',
                  name: 'name',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      __typename: '__Type',
                      kind: 'SCALAR',
                      name: 'String',
                      ofType: null
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__Field',
                  name: 'description',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__Field',
                  name: 'args',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      __typename: '__Type',
                      kind: 'LIST',
                      name: null,
                      ofType: {
                        __typename: '__Type',
                        kind: 'NON_NULL',
                        name: null,
                        ofType: {
                          __typename: '__Type',
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
                  __typename: '__Field',
                  name: 'type',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      __typename: '__Type',
                      kind: 'OBJECT',
                      name: '__Type',
                      ofType: null
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__Field',
                  name: 'isDeprecated',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      __typename: '__Type',
                      kind: 'SCALAR',
                      name: 'Boolean',
                      ofType: null
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__Field',
                  name: 'deprecationReason',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                }
              ],
              interfaces: [],
              enumValues: null
            },
            {
              __typename: '__Type',
              kind: 'OBJECT',
              name: '__InputValue',
              fields: [
                {
                  __typename: '__Field',
                  name: 'name',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      __typename: '__Type',
                      kind: 'SCALAR',
                      name: 'String',
                      ofType: null
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__Field',
                  name: 'description',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__Field',
                  name: 'type',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      __typename: '__Type',
                      kind: 'OBJECT',
                      name: '__Type',
                      ofType: null
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__Field',
                  name: 'defaultValue',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                }
              ],
              interfaces: [],
              enumValues: null
            },
            {
              __typename: '__Type',
              kind: 'OBJECT',
              name: '__EnumValue',
              fields: [
                {
                  __typename: '__Field',
                  name: 'name',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      __typename: '__Type',
                      kind: 'SCALAR',
                      name: 'String',
                      ofType: null
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__Field',
                  name: 'description',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__Field',
                  name: 'isDeprecated',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      __typename: '__Type',
                      kind: 'SCALAR',
                      name: 'Boolean',
                      ofType: null
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__Field',
                  name: 'deprecationReason',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                }
              ],
              interfaces: [],
              enumValues: null
            },
            {
              __typename: '__Type',
              kind: 'OBJECT',
              name: '__Directive',
              fields: [
                {
                  __typename: '__Field',
                  name: 'name',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      __typename: '__Type',
                      kind: 'SCALAR',
                      name: 'String',
                      ofType: null
                    }
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__Field',
                  name: 'description',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__Field',
                  name: 'args',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      __typename: '__Type',
                      kind: 'LIST',
                      name: null,
                      ofType: {
                        __typename: '__Type',
                        kind: 'NON_NULL',
                        name: null,
                        ofType: {
                          __typename: '__Type',
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
                  __typename: '__Field',
                  name: 'onOperation',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'SCALAR',
                    name: 'Boolean',
                    ofType: null,
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__Field',
                  name: 'onFragment',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'SCALAR',
                    name: 'Boolean',
                    ofType: null,
                  },
                  isDeprecated: false,
                  deprecationReason: null
                },
                {
                  __typename: '__Field',
                  name: 'onField',
                  args: [],
                  type: {
                    __typename: '__Type',
                    kind: 'SCALAR',
                    name: 'Boolean',
                    ofType: null,
                  },
                  isDeprecated: false,
                  deprecationReason: null
                }
              ],
              interfaces: [],
              enumValues: null,
            }
          ],
          directives: [
            {
              __typename: '__Directive',
              name: 'include',
              args: [
                {
                  __typename: '__InputValue',
                  defaultValue: null,
                  name: 'if',
                  type: {
                    __typename: '__Type',
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      __typename: '__Type',
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
              __typename: '__Directive',
              name: 'skip',
              args: [
                {
                  __typename: '__InputValue',
                  defaultValue: null,
                  name: 'if',
                  type: {
                    __typename: '__Type',
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      __typename: '__Type',
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

  it('introspects on input object', () => {

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
      graphql(schema, request)
    ).to.eventually.containSubset({
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

  it('supports the __type root field', () => {
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
      graphql(schema, request)
    ).to.become({
      data: {
        __type: {
          name: 'TestType'
        }
      }
    });
  });

  it('identifies deprecated fields', () => {

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
      graphql(schema, request)
    ).to.become({
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

  it('respects the includeDeprecated parameter for fields', () => {

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
      graphql(schema, request)
    ).to.become({
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

  it('identifies deprecated enum values', () => {

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
      graphql(schema, request)
    ).to.become({
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

  it('respects the includeDeprecated parameter for enum values', () => {

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
      graphql(schema, request)
    ).to.become({
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

  it('fails as expected on the __type root field without an arg', () => {
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
      graphql(schema, request)
    ).to.become({
      errors: [
        { message: missingFieldArgMessage('__type', 'name', 'String!'),
          locations: [ { line: 3, column: 9 } ] }
      ]
    });
  });

  it('exposes descriptions on types and fields', () => {
    var QueryRoot = new GraphQLObjectType({
      name: 'QueryRoot',
      fields: {}
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
      graphql(schema, request)
    ).to.become({
      data: {
        schemaType: {
          name: '__Schema',
          description: 'A GraphQL Schema defines the capabilities of a ' +
                       'GraphQL server. It exposes all available types and ' +
                       'directives on the server, as well as the entry ' +
                       'points for query and mutation operations.',
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
              name: 'directives',
              description: 'A list of all directives supported by this server.'
            }
          ]
        }
      }
    });
  });

  it('exposes descriptions on enums', () => {
    var QueryRoot = new GraphQLObjectType({
      name: 'QueryRoot',
      fields: {}
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
      graphql(schema, request)
    ).to.become({
      data: {
        typeKindType: {
          name: '__TypeKind',
          description: 'An enum describing what kind of type a given __Type is',
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

});
