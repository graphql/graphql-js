// @flow strict

import { expect } from 'chai';
import { describe, it } from 'mocha';

import invariant from '../../jsutils/invariant';

import { graphqlSync } from '../../graphql';
import { getIntrospectionQuery } from '../../utilities/getIntrospectionQuery';

import { GraphQLSchema } from '../schema';
import { GraphQLString } from '../scalars';
import {
  GraphQLList,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLEnumType,
} from '../definition';

describe('Introspection', () => {
  it('executes an introspection query', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'QueryRoot',
        fields: {
          onlyField: { type: GraphQLString },
        },
      }),
    });
    const source = getIntrospectionQuery({ descriptions: false });

    const result = graphqlSync({ schema, source });
    expect(result).to.deep.equal({
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
              fields: [
                {
                  name: 'onlyField',
                  args: [],
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                  isDeprecated: false,
                  deprecationReason: null,
                },
              ],
              inputFields: null,
              interfaces: [],
              enumValues: null,
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
                          name: '__Type',
                          ofType: null,
                        },
                      },
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null,
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
                      ofType: null,
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'mutationType',
                  args: [],
                  type: {
                    kind: 'OBJECT',
                    name: '__Type',
                    ofType: null,
                  },
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'subscriptionType',
                  args: [],
                  type: {
                    kind: 'OBJECT',
                    name: '__Type',
                    ofType: null,
                  },
                  isDeprecated: false,
                  deprecationReason: null,
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
                          name: '__Directive',
                          ofType: null,
                        },
                      },
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null,
                },
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
                      ofType: null,
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'name',
                  args: [],
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'description',
                  args: [],
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'fields',
                  args: [
                    {
                      name: 'includeDeprecated',
                      type: {
                        kind: 'SCALAR',
                        name: 'Boolean',
                        ofType: null,
                      },
                      defaultValue: 'false',
                    },
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
                        ofType: null,
                      },
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null,
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
                        ofType: null,
                      },
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null,
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
                        ofType: null,
                      },
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'enumValues',
                  args: [
                    {
                      name: 'includeDeprecated',
                      type: {
                        kind: 'SCALAR',
                        name: 'Boolean',
                        ofType: null,
                      },
                      defaultValue: 'false',
                    },
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
                        ofType: null,
                      },
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null,
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
                        ofType: null,
                      },
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'ofType',
                  args: [],
                  type: {
                    kind: 'OBJECT',
                    name: '__Type',
                    ofType: null,
                  },
                  isDeprecated: false,
                  deprecationReason: null,
                },
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
                  deprecationReason: null,
                },
                {
                  name: 'OBJECT',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'INTERFACE',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'UNION',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'ENUM',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'INPUT_OBJECT',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'LIST',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'NON_NULL',
                  isDeprecated: false,
                  deprecationReason: null,
                },
              ],
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
                      ofType: null,
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'description',
                  args: [],
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                  isDeprecated: false,
                  deprecationReason: null,
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
                          name: '__InputValue',
                          ofType: null,
                        },
                      },
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null,
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
                      ofType: null,
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null,
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
                      ofType: null,
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'deprecationReason',
                  args: [],
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                  isDeprecated: false,
                  deprecationReason: null,
                },
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
                      ofType: null,
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'description',
                  args: [],
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                  isDeprecated: false,
                  deprecationReason: null,
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
                      ofType: null,
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'defaultValue',
                  args: [],
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                  isDeprecated: false,
                  deprecationReason: null,
                },
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
                      ofType: null,
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'description',
                  args: [],
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                  isDeprecated: false,
                  deprecationReason: null,
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
                      ofType: null,
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'deprecationReason',
                  args: [],
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                  isDeprecated: false,
                  deprecationReason: null,
                },
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
                      ofType: null,
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'description',
                  args: [],
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'locations',
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
                          kind: 'ENUM',
                          name: '__DirectiveLocation',
                          ofType: null,
                        },
                      },
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null,
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
                          name: '__InputValue',
                          ofType: null,
                        },
                      },
                    },
                  },
                  isDeprecated: false,
                  deprecationReason: null,
                },
              ],
              inputFields: null,
              interfaces: [],
              enumValues: null,
              possibleTypes: null,
            },
            {
              kind: 'ENUM',
              name: '__DirectiveLocation',
              fields: null,
              inputFields: null,
              interfaces: null,
              enumValues: [
                {
                  name: 'QUERY',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'MUTATION',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'SUBSCRIPTION',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'FIELD',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'FRAGMENT_DEFINITION',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'FRAGMENT_SPREAD',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'INLINE_FRAGMENT',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'VARIABLE_DEFINITION',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'SCHEMA',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'SCALAR',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'OBJECT',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'FIELD_DEFINITION',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'ARGUMENT_DEFINITION',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'INTERFACE',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'UNION',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'ENUM',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'ENUM_VALUE',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'INPUT_OBJECT',
                  isDeprecated: false,
                  deprecationReason: null,
                },
                {
                  name: 'INPUT_FIELD_DEFINITION',
                  isDeprecated: false,
                  deprecationReason: null,
                },
              ],
              possibleTypes: null,
            },
          ],
          directives: [
            {
              name: 'include',
              locations: ['FIELD', 'FRAGMENT_SPREAD', 'INLINE_FRAGMENT'],
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
                      ofType: null,
                    },
                  },
                },
              ],
            },
            {
              name: 'skip',
              locations: ['FIELD', 'FRAGMENT_SPREAD', 'INLINE_FRAGMENT'],
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
                      ofType: null,
                    },
                  },
                },
              ],
            },
            {
              name: 'deprecated',
              locations: ['FIELD_DEFINITION', 'ENUM_VALUE'],
              args: [
                {
                  defaultValue: '"No longer supported"',
                  name: 'reason',
                  type: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              ],
            },
          ],
        },
      },
    });
  });

  it('introspects on input object', () => {
    const TestInputObject = new GraphQLInputObjectType({
      name: 'TestInputObject',
      fields: {
        a: { type: GraphQLString, defaultValue: 'tes\t de\fault' },
        b: { type: GraphQLList(GraphQLString) },
        c: { type: GraphQLString, defaultValue: null },
      },
    });

    const TestType = new GraphQLObjectType({
      name: 'TestType',
      fields: {
        field: {
          type: GraphQLString,
          args: { complex: { type: TestInputObject } },
        },
      },
    });

    const schema = new GraphQLSchema({ query: TestType });
    const source = `
      {
        __type(name: "TestInputObject") {
          kind
          name
          inputFields {
            name
            type { ...TypeRef }
            defaultValue
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

    expect(graphqlSync({ schema, source })).to.deep.equal({
      data: {
        __type: {
          kind: 'INPUT_OBJECT',
          name: 'TestInputObject',
          inputFields: [
            {
              name: 'a',
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: '"tes\\t de\\fault"',
            },
            {
              name: 'b',
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              defaultValue: null,
            },
            {
              name: 'c',
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: 'null',
            },
          ],
        },
      },
    });
  });

  it('supports the __type root field', () => {
    const TestType = new GraphQLObjectType({
      name: 'TestType',
      fields: {
        testField: {
          type: GraphQLString,
        },
      },
    });

    const schema = new GraphQLSchema({ query: TestType });
    const source = `
      {
        __type(name: "TestType") {
          name
        }
      }
    `;

    expect(graphqlSync({ schema, source })).to.deep.equal({
      data: {
        __type: {
          name: 'TestType',
        },
      },
    });
  });

  it('identifies deprecated fields', () => {
    const TestType = new GraphQLObjectType({
      name: 'TestType',
      fields: {
        nonDeprecated: {
          type: GraphQLString,
        },
        deprecated: {
          type: GraphQLString,
          deprecationReason: 'Removed in 1.0',
        },
      },
    });

    const schema = new GraphQLSchema({ query: TestType });
    const source = `
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

    expect(graphqlSync({ schema, source })).to.deep.equal({
      data: {
        __type: {
          name: 'TestType',
          fields: [
            {
              name: 'nonDeprecated',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'deprecated',
              isDeprecated: true,
              deprecationReason: 'Removed in 1.0',
            },
          ],
        },
      },
    });
  });

  it('respects the includeDeprecated parameter for fields', () => {
    const TestType = new GraphQLObjectType({
      name: 'TestType',
      fields: {
        nonDeprecated: {
          type: GraphQLString,
        },
        deprecated: {
          type: GraphQLString,
          deprecationReason: 'Removed in 1.0',
        },
      },
    });

    const schema = new GraphQLSchema({ query: TestType });
    const source = `
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

    expect(graphqlSync({ schema, source })).to.deep.equal({
      data: {
        __type: {
          name: 'TestType',
          trueFields: [
            {
              name: 'nonDeprecated',
            },
            {
              name: 'deprecated',
            },
          ],
          falseFields: [
            {
              name: 'nonDeprecated',
            },
          ],
          omittedFields: [
            {
              name: 'nonDeprecated',
            },
          ],
        },
      },
    });
  });

  it('identifies deprecated enum values', () => {
    const TestEnum = new GraphQLEnumType({
      name: 'TestEnum',
      values: {
        NON_DEPRECATED: { value: 0 },
        DEPRECATED: { value: 1, deprecationReason: 'Removed in 1.0' },
        ALSO_NON_DEPRECATED: { value: 2 },
      },
    });

    const TestType = new GraphQLObjectType({
      name: 'TestType',
      fields: {
        testEnum: {
          type: TestEnum,
        },
      },
    });

    const schema = new GraphQLSchema({ query: TestType });
    const source = `
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

    expect(graphqlSync({ schema, source })).to.deep.equal({
      data: {
        __type: {
          name: 'TestEnum',
          enumValues: [
            {
              name: 'NON_DEPRECATED',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'DEPRECATED',
              isDeprecated: true,
              deprecationReason: 'Removed in 1.0',
            },
            {
              name: 'ALSO_NON_DEPRECATED',
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
        },
      },
    });
  });

  it('respects the includeDeprecated parameter for enum values', () => {
    const TestEnum = new GraphQLEnumType({
      name: 'TestEnum',
      values: {
        NON_DEPRECATED: { value: 0 },
        DEPRECATED: { value: 1, deprecationReason: 'Removed in 1.0' },
        ALSO_NON_DEPRECATED: { value: 2 },
      },
    });

    const TestType = new GraphQLObjectType({
      name: 'TestType',
      fields: {
        testEnum: {
          type: TestEnum,
        },
      },
    });

    const schema = new GraphQLSchema({ query: TestType });
    const source = `
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

    expect(graphqlSync({ schema, source })).to.deep.equal({
      data: {
        __type: {
          name: 'TestEnum',
          trueValues: [
            {
              name: 'NON_DEPRECATED',
            },
            {
              name: 'DEPRECATED',
            },
            {
              name: 'ALSO_NON_DEPRECATED',
            },
          ],
          falseValues: [
            {
              name: 'NON_DEPRECATED',
            },
            {
              name: 'ALSO_NON_DEPRECATED',
            },
          ],
          omittedValues: [
            {
              name: 'NON_DEPRECATED',
            },
            {
              name: 'ALSO_NON_DEPRECATED',
            },
          ],
        },
      },
    });
  });

  it('fails as expected on the __type root field without an arg', () => {
    const TestType = new GraphQLObjectType({
      name: 'TestType',
      fields: {
        testField: {
          type: GraphQLString,
        },
      },
    });

    const schema = new GraphQLSchema({ query: TestType });
    const source = `
      {
        __type {
          name
        }
      }
    `;

    expect(graphqlSync({ schema, source })).to.deep.equal({
      errors: [
        {
          message:
            'Field "__type" argument "name" of type "String!" is required, but it was not provided.',
          locations: [{ line: 3, column: 9 }],
        },
      ],
    });
  });

  it('exposes descriptions on types and fields', () => {
    const QueryRoot = new GraphQLObjectType({
      name: 'QueryRoot',
      fields: {
        onlyField: { type: GraphQLString },
      },
    });

    const schema = new GraphQLSchema({ query: QueryRoot });
    const source = `
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

    expect(graphqlSync({ schema, source })).to.deep.equal({
      data: {
        schemaType: {
          name: '__Schema',
          description:
            'A GraphQL Schema defines the capabilities of a GraphQL server. It exposes all available types and directives on the server, as well as the entry points for query, mutation, and subscription operations.',
          fields: [
            {
              name: 'types',
              description: 'A list of all types supported by this server.',
            },
            {
              name: 'queryType',
              description: 'The type that query operations will be rooted at.',
            },
            {
              name: 'mutationType',
              description:
                'If this server supports mutation, the type that mutation operations will be rooted at.',
            },
            {
              name: 'subscriptionType',
              description:
                'If this server support subscription, the type that subscription operations will be rooted at.',
            },
            {
              name: 'directives',
              description: 'A list of all directives supported by this server.',
            },
          ],
        },
      },
    });
  });

  it('exposes descriptions on enums', () => {
    const QueryRoot = new GraphQLObjectType({
      name: 'QueryRoot',
      fields: {
        onlyField: { type: GraphQLString },
      },
    });

    const schema = new GraphQLSchema({ query: QueryRoot });
    const source = `
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

    expect(graphqlSync({ schema, source })).to.deep.equal({
      data: {
        typeKindType: {
          name: '__TypeKind',
          description:
            'An enum describing what kind of type a given `__Type` is.',
          enumValues: [
            {
              description: 'Indicates this type is a scalar.',
              name: 'SCALAR',
            },
            {
              description:
                'Indicates this type is an object. `fields` and `interfaces` are valid fields.',
              name: 'OBJECT',
            },
            {
              description:
                'Indicates this type is an interface. `fields`, `interfaces`, and `possibleTypes` are valid fields.',
              name: 'INTERFACE',
            },
            {
              description:
                'Indicates this type is a union. `possibleTypes` is a valid field.',
              name: 'UNION',
            },
            {
              description:
                'Indicates this type is an enum. `enumValues` is a valid field.',
              name: 'ENUM',
            },
            {
              description:
                'Indicates this type is an input object. `inputFields` is a valid field.',
              name: 'INPUT_OBJECT',
            },
            {
              description:
                'Indicates this type is a list. `ofType` is a valid field.',
              name: 'LIST',
            },
            {
              description:
                'Indicates this type is a non-null. `ofType` is a valid field.',
              name: 'NON_NULL',
            },
          ],
        },
      },
    });
  });

  it('executes an introspection query without calling global fieldResolver', () => {
    const QueryRoot = new GraphQLObjectType({
      name: 'QueryRoot',
      fields: {
        onlyField: { type: GraphQLString },
      },
    });

    const schema = new GraphQLSchema({ query: QueryRoot });
    const source = getIntrospectionQuery();

    function fieldResolver(_1, _2, _3, info) {
      invariant(false, `Called on ${info.parentType.name}::${info.fieldName}`);
    }

    graphqlSync({ schema, source, fieldResolver });
  });
});
