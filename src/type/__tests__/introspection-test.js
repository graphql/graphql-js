// @flow strict

import { expect } from 'chai';
import { describe, it } from 'mocha';

import invariant from '../../jsutils/invariant';

import { buildSchema } from '../../utilities/buildASTSchema';
import { getIntrospectionQuery } from '../../utilities/getIntrospectionQuery';

import { graphqlSync } from '../../graphql';

describe('Introspection', () => {
  it('executes an introspection query', () => {
    const schema = buildSchema(`
      type SomeObject {
        someField: String
      }

      schema {
        query: SomeObject
      }
    `);

    const source = getIntrospectionQuery({
      descriptions: false,
      specifiedByUrl: true,
      directiveIsRepeatable: true,
    });

    const result = graphqlSync({ schema, source });
    expect(result).to.deep.equal({
      data: {
        __schema: {
          queryType: { name: 'SomeObject' },
          mutationType: null,
          subscriptionType: null,
          types: [
            {
              kind: 'OBJECT',
              name: 'SomeObject',
              specifiedByUrl: null,
              fields: [
                {
                  name: 'someField',
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
              specifiedByUrl: null,
              fields: null,
              inputFields: null,
              interfaces: null,
              enumValues: null,
              possibleTypes: null,
            },
            {
              kind: 'SCALAR',
              name: 'Boolean',
              specifiedByUrl: null,
              fields: null,
              inputFields: null,
              interfaces: null,
              enumValues: null,
              possibleTypes: null,
            },
            {
              kind: 'OBJECT',
              name: '__Schema',
              specifiedByUrl: null,
              fields: [
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
              specifiedByUrl: null,
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
                  name: 'specifiedByUrl',
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
              specifiedByUrl: null,
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
              kind: 'OBJECT',
              name: '__Field',
              specifiedByUrl: null,
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
              specifiedByUrl: null,
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
              specifiedByUrl: null,
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
              specifiedByUrl: null,
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
                  name: 'isRepeatable',
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
              specifiedByUrl: null,
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
              isRepeatable: false,
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
              isRepeatable: false,
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
              isRepeatable: false,
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
            {
              name: 'specifiedBy',
              isRepeatable: false,
              locations: ['SCALAR'],
              args: [
                {
                  defaultValue: null,
                  name: 'url',
                  type: {
                    kind: 'NON_NULL',
                    name: null,
                    ofType: {
                      kind: 'SCALAR',
                      name: 'String',
                      ofType: null,
                    },
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
    const schema = buildSchema(`
      input SomeInputObject {
        a: String = "tes\\t de\\fault"
        b: [String]
        c: String = null
      }

      type Query {
        someField(someArg: SomeInputObject): String
      }
    `);

    const source = `
      {
        __type(name: "SomeInputObject") {
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
          name: 'SomeInputObject',
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
    const schema = buildSchema(`
      type Query {
        someField: String
      }
    `);

    const source = `
      {
        __type(name: "Query") {
          name
        }
      }
    `;

    expect(graphqlSync({ schema, source })).to.deep.equal({
      data: {
        __type: { name: 'Query' },
      },
    });
  });

  it('identifies deprecated fields', () => {
    const schema = buildSchema(`
      type Query {
        nonDeprecated: String
        deprecated: String @deprecated(reason: "Removed in 1.0")
        deprecatedWithEmptyReason: String @deprecated(reason: "")
      }
    `);

    const source = `
      {
        __type(name: "Query") {
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
            {
              name: 'deprecatedWithEmptyReason',
              isDeprecated: true,
              deprecationReason: '',
            },
          ],
        },
      },
    });
  });

  it('respects the includeDeprecated parameter for fields', () => {
    const schema = buildSchema(`
      type Query {
        nonDeprecated: String
        deprecated: String @deprecated(reason: "Removed in 1.0")
      }
    `);

    const source = `
      {
        __type(name: "Query") {
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
          trueFields: [{ name: 'nonDeprecated' }, { name: 'deprecated' }],
          falseFields: [{ name: 'nonDeprecated' }],
          omittedFields: [{ name: 'nonDeprecated' }],
        },
      },
    });
  });

  it('identifies deprecated enum values', () => {
    const schema = buildSchema(`
      enum SomeEnum {
        NON_DEPRECATED
        DEPRECATED @deprecated(reason: "Removed in 1.0")
        ALSO_NON_DEPRECATED
      }

      type Query {
        someField(someArg: SomeEnum): String
      }
    `);

    const source = `
      {
        __type(name: "SomeEnum") {
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
    const schema = buildSchema(`
      enum SomeEnum {
        NON_DEPRECATED
        DEPRECATED @deprecated(reason: "Removed in 1.0")
        DEPRECATED_WITH_EMPTY_REASON @deprecated(reason: "")
        ALSO_NON_DEPRECATED
      }

      type Query {
        someField(someArg: SomeEnum): String
      }
    `);

    const source = `
      {
        __type(name: "SomeEnum") {
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
          trueValues: [
            { name: 'NON_DEPRECATED' },
            { name: 'DEPRECATED' },
            { name: 'DEPRECATED_WITH_EMPTY_REASON' },
            { name: 'ALSO_NON_DEPRECATED' },
          ],
          falseValues: [
            { name: 'NON_DEPRECATED' },
            { name: 'ALSO_NON_DEPRECATED' },
          ],
          omittedValues: [
            { name: 'NON_DEPRECATED' },
            { name: 'ALSO_NON_DEPRECATED' },
          ],
        },
      },
    });
  });

  it('fails as expected on the __type root field without an arg', () => {
    const schema = buildSchema(`
      type Query {
        someField: String
      }
    `);

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

  it('exposes descriptions', () => {
    const schema = buildSchema(`
      """Enum description"""
      enum SomeEnum {
        """Value description"""
        VALUE
      }

      """Object description"""
      type SomeObject {
        """Field description"""
        someField(arg: SomeEnum): String
      }

      """Schema description"""
      schema {
        query: SomeObject
      }
    `);

    const source = `
      {
        Schema: __schema { description }
        SomeObject: __type(name: "SomeObject") {
          description,
          fields {
            name
            description
          }
        }
        SomeEnum: __type(name: "SomeEnum") {
          description
          enumValues {
            name
            description
          }
        }
      }
    `;

    expect(graphqlSync({ schema, source })).to.deep.equal({
      data: {
        Schema: {
          description: 'Schema description',
        },
        SomeEnum: {
          description: 'Enum description',
          enumValues: [
            {
              name: 'VALUE',
              description: 'Value description',
            },
          ],
        },
        SomeObject: {
          description: 'Object description',
          fields: [
            {
              name: 'someField',
              description: 'Field description',
            },
          ],
        },
      },
    });
  });

  it('executes an introspection query without calling global resolvers', () => {
    const schema = buildSchema(`
      type Query {
        someField: String
      }
    `);

    const source = getIntrospectionQuery({
      specifiedByUrl: true,
      directiveIsRepeatable: true,
      schemaDescription: true,
    });

    // istanbul ignore next (Called only to fail test)
    function fieldResolver(_1, _2, _3, info) {
      invariant(false, `Called on ${info.parentType.name}::${info.fieldName}`);
    }

    // istanbul ignore next (Called only to fail test)
    function typeResolver(_1, _2, info) {
      invariant(false, `Called on ${info.parentType.name}::${info.fieldName}`);
    }

    expect(() =>
      graphqlSync({
        schema,
        source,
        fieldResolver,
        typeResolver,
      }),
    ).to.not.throw();
  });
});
