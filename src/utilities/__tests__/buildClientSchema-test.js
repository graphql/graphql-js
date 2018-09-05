/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { buildClientSchema } from '../buildClientSchema';
import { introspectionFromSchema } from '../introspectionFromSchema';
import {
  graphqlSync,
  GraphQLSchema,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLBoolean,
  GraphQLID,
  GraphQLDirective,
} from '../../';

// Test property:
// Given a server's schema, a client may query that server with introspection,
// and use the result to produce a client-side representation of the schema
// by using "buildClientSchema". If the client then runs the introspection
// query against the client-side schema, it should get a result identical to
// what was returned by the server.
function testSchema(serverSchema) {
  const initialIntrospection = introspectionFromSchema(serverSchema);
  const clientSchema = buildClientSchema(initialIntrospection);
  const secondIntrospection = introspectionFromSchema(clientSchema);
  expect(secondIntrospection).to.deep.equal(initialIntrospection);
}

describe('Type System: build schema from introspection', () => {
  it('builds a simple schema', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Simple',
        description: 'This is a simple type',
        fields: {
          string: {
            type: GraphQLString,
            description: 'This is a string field',
          },
        },
      }),
    });

    testSchema(schema);
  });

  it('builds a simple schema with all operation types', () => {
    const queryType = new GraphQLObjectType({
      name: 'QueryType',
      description: 'This is a simple query type',
      fields: {
        string: {
          type: GraphQLString,
          description: 'This is a string field',
        },
      },
    });

    const mutationType = new GraphQLObjectType({
      name: 'MutationType',
      description: 'This is a simple mutation type',
      fields: {
        setString: {
          type: GraphQLString,
          description: 'Set the string field',
          args: {
            value: { type: GraphQLString },
          },
        },
      },
    });

    const subscriptionType = new GraphQLObjectType({
      name: 'SubscriptionType',
      description: 'This is a simple subscription type',
      fields: {
        string: {
          type: GraphQLString,
          description: 'This is a string field',
        },
      },
    });

    const schema = new GraphQLSchema({
      query: queryType,
      mutation: mutationType,
      subscription: subscriptionType,
    });

    testSchema(schema);
  });

  it('uses built-in scalars when possible', () => {
    const customScalar = new GraphQLScalarType({
      name: 'CustomScalar',
      serialize: () => null,
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Scalars',
        fields: {
          int: { type: GraphQLInt },
          float: { type: GraphQLFloat },
          string: { type: GraphQLString },
          boolean: { type: GraphQLBoolean },
          id: { type: GraphQLID },
          custom: { type: customScalar },
        },
      }),
    });

    testSchema(schema);

    const introspection = introspectionFromSchema(schema);
    const clientSchema = buildClientSchema(introspection);

    // Built-ins are used
    expect(clientSchema.getType('Int')).to.equal(GraphQLInt);
    expect(clientSchema.getType('Float')).to.equal(GraphQLFloat);
    expect(clientSchema.getType('String')).to.equal(GraphQLString);
    expect(clientSchema.getType('Boolean')).to.equal(GraphQLBoolean);
    expect(clientSchema.getType('ID')).to.equal(GraphQLID);

    // Custom are built
    expect(clientSchema.getType('CustomScalar')).not.to.equal(customScalar);
  });

  it('builds a schema with a recursive type reference', () => {
    const recurType = new GraphQLObjectType({
      name: 'Recur',
      fields: () => ({
        recur: { type: recurType },
      }),
    });
    const schema = new GraphQLSchema({
      query: recurType,
    });

    testSchema(schema);
  });

  it('builds a schema with a circular type reference', () => {
    const dogType = new GraphQLObjectType({
      name: 'Dog',
      fields: () => ({
        bestFriend: { type: humanType },
      }),
    });
    const humanType = new GraphQLObjectType({
      name: 'Human',
      fields: () => ({
        bestFriend: { type: dogType },
      }),
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Circular',
        fields: {
          dog: { type: dogType },
          human: { type: humanType },
        },
      }),
    });

    testSchema(schema);
  });

  it('builds a schema with an interface', () => {
    const friendlyType = new GraphQLInterfaceType({
      name: 'Friendly',
      fields: () => ({
        bestFriend: {
          type: friendlyType,
          description: 'The best friend of this friendly thing',
        },
      }),
    });
    const dogType = new GraphQLObjectType({
      name: 'Dog',
      interfaces: [friendlyType],
      fields: () => ({
        bestFriend: { type: friendlyType },
      }),
    });
    const humanType = new GraphQLObjectType({
      name: 'Human',
      interfaces: [friendlyType],
      fields: () => ({
        bestFriend: { type: friendlyType },
      }),
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'WithInterface',
        fields: {
          friendly: { type: friendlyType },
        },
      }),
      types: [dogType, humanType],
    });

    testSchema(schema);
  });

  it('builds a schema with an implicit interface', () => {
    const friendlyType = new GraphQLInterfaceType({
      name: 'Friendly',
      fields: () => ({
        bestFriend: {
          type: friendlyType,
          description: 'The best friend of this friendly thing',
        },
      }),
    });
    const dogType = new GraphQLObjectType({
      name: 'Dog',
      interfaces: [friendlyType],
      fields: () => ({
        bestFriend: { type: dogType },
      }),
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'WithInterface',
        fields: {
          dog: { type: dogType },
        },
      }),
    });

    testSchema(schema);
  });

  it('builds a schema with a union', () => {
    const dogType = new GraphQLObjectType({
      name: 'Dog',
      fields: () => ({
        bestFriend: { type: friendlyType },
      }),
    });
    const humanType = new GraphQLObjectType({
      name: 'Human',
      fields: () => ({
        bestFriend: { type: friendlyType },
      }),
    });
    const friendlyType = new GraphQLUnionType({
      name: 'Friendly',
      types: [dogType, humanType],
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'WithUnion',
        fields: {
          friendly: { type: friendlyType },
        },
      }),
    });

    testSchema(schema);
  });

  it('builds a schema with complex field values', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'ComplexFields',
        fields: {
          string: { type: GraphQLString },
          listOfString: { type: GraphQLList(GraphQLString) },
          nonNullString: {
            type: GraphQLNonNull(GraphQLString),
          },
          nonNullListOfString: {
            type: GraphQLNonNull(GraphQLList(GraphQLString)),
          },
          nonNullListOfNonNullString: {
            type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLString))),
          },
        },
      }),
    });

    testSchema(schema);
  });

  it('builds a schema with field arguments', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'ArgFields',
        fields: {
          one: {
            description: 'A field with a single arg',
            type: GraphQLString,
            args: {
              intArg: {
                description: 'This is an int arg',
                type: GraphQLInt,
              },
            },
          },
          two: {
            description: 'A field with a two args',
            type: GraphQLString,
            args: {
              listArg: {
                description: 'This is an list of int arg',
                type: GraphQLList(GraphQLInt),
              },
              requiredArg: {
                description: 'This is a required arg',
                type: GraphQLNonNull(GraphQLBoolean),
              },
            },
          },
        },
      }),
    });

    testSchema(schema);
  });

  it('builds a schema with default value on custom scalar field', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'ArgFields',
        fields: {
          testField: {
            type: GraphQLString,
            args: {
              testArg: {
                type: new GraphQLScalarType({
                  name: 'CustomScalar',
                  serialize: value => value,
                }),
                defaultValue: 'default',
              },
            },
          },
        },
      }),
    });

    testSchema(schema);
  });

  it('builds a schema with an enum', () => {
    const foodEnum = new GraphQLEnumType({
      name: 'Food',
      description: 'Varieties of food stuffs',
      values: {
        VEGETABLES: {
          description: 'Foods that are vegetables.',
          value: 1,
        },
        FRUITS: {
          description: 'Foods that are fruits.',
          value: 2,
        },
        OILS: {
          description: 'Foods that are oils.',
          value: 3,
        },
        DAIRY: {
          description: 'Foods that are dairy.',
          value: 4,
        },
        MEAT: {
          description: 'Foods that are meat.',
          value: 5,
        },
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'EnumFields',
        fields: {
          food: {
            description: 'Repeats the arg you give it',
            type: foodEnum,
            args: {
              kind: {
                description: 'what kind of food?',
                type: foodEnum,
              },
            },
          },
        },
      }),
    });

    testSchema(schema);

    const introspection = introspectionFromSchema(schema);
    const clientSchema = buildClientSchema(introspection);
    const clientFoodEnum = clientSchema.getType('Food');

    // It's also an Enum type on the client.
    expect(clientFoodEnum).to.be.an.instanceOf(GraphQLEnumType);

    // Client types do not get server-only values, so `value` mirrors `name`,
    // rather than using the integers defined in the "server" schema.
    expect(clientFoodEnum.getValues()).to.deep.equal([
      {
        name: 'VEGETABLES',
        value: 'VEGETABLES',
        description: 'Foods that are vegetables.',
        isDeprecated: false,
        deprecationReason: null,
        astNode: undefined,
      },
      {
        name: 'FRUITS',
        value: 'FRUITS',
        description: 'Foods that are fruits.',
        isDeprecated: false,
        deprecationReason: null,
        astNode: undefined,
      },
      {
        name: 'OILS',
        value: 'OILS',
        description: 'Foods that are oils.',
        isDeprecated: false,
        deprecationReason: null,
        astNode: undefined,
      },
      {
        name: 'DAIRY',
        value: 'DAIRY',
        description: 'Foods that are dairy.',
        isDeprecated: false,
        deprecationReason: null,
        astNode: undefined,
      },
      {
        name: 'MEAT',
        value: 'MEAT',
        description: 'Foods that are meat.',
        isDeprecated: false,
        deprecationReason: null,
        astNode: undefined,
      },
    ]);
  });

  it('builds a schema with an input object', () => {
    const addressType = new GraphQLInputObjectType({
      name: 'Address',
      description: 'An input address',
      fields: {
        street: {
          description: 'What street is this address?',
          type: GraphQLNonNull(GraphQLString),
        },
        city: {
          description: 'The city the address is within?',
          type: GraphQLNonNull(GraphQLString),
        },
        country: {
          description: 'The country (blank will assume USA).',
          type: GraphQLString,
          defaultValue: 'USA',
        },
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'HasInputObjectFields',
        fields: {
          geocode: {
            description: 'Get a geocode from an address',
            type: GraphQLString,
            args: {
              address: {
                description: 'The address to lookup',
                type: addressType,
              },
            },
          },
        },
      }),
    });

    testSchema(schema);
  });

  it('builds a schema with field arguments with default values', () => {
    const geoType = new GraphQLInputObjectType({
      name: 'Geo',
      fields: {
        lat: { type: GraphQLFloat },
        lon: { type: GraphQLFloat },
      },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'ArgFields',
        fields: {
          defaultInt: {
            type: GraphQLString,
            args: {
              intArg: {
                type: GraphQLInt,
                defaultValue: 10,
              },
            },
          },
          defaultList: {
            type: GraphQLString,
            args: {
              listArg: {
                type: GraphQLList(GraphQLInt),
                defaultValue: [1, 2, 3],
              },
            },
          },
          defaultObject: {
            type: GraphQLString,
            args: {
              objArg: {
                type: geoType,
                defaultValue: { lat: 37.485, lon: -122.148 },
              },
            },
          },
          defaultNull: {
            type: GraphQLString,
            args: {
              intArg: {
                type: GraphQLInt,
                defaultValue: null,
              },
            },
          },
          noDefault: {
            type: GraphQLString,
            args: {
              intArg: {
                type: GraphQLInt,
              },
            },
          },
        },
      }),
    });

    testSchema(schema);
  });

  it('builds a schema with custom directives', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Simple',
        description: 'This is a simple type',
        fields: {
          string: {
            type: GraphQLString,
            description: 'This is a string field',
          },
        },
      }),
      directives: [
        new GraphQLDirective({
          name: 'customDirective',
          description: 'This is a custom directive',
          locations: ['FIELD'],
        }),
      ],
    });

    testSchema(schema);
  });

  it('builds a schema with legacy names', () => {
    const introspection = {
      __schema: {
        queryType: {
          name: 'Query',
        },
        types: [
          {
            name: 'Query',
            kind: 'OBJECT',
            fields: [
              {
                name: '__badName',
                args: [],
                type: { name: 'String' },
              },
            ],
            interfaces: [],
          },
        ],
      },
    };
    const schema = buildClientSchema(introspection, {
      allowedLegacyNames: ['__badName'],
    });
    expect(schema.__allowedLegacyNames).to.deep.equal(['__badName']);
  });

  it('builds a schema aware of deprecation', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Simple',
        description: 'This is a simple type',
        fields: {
          shinyString: {
            type: GraphQLString,
            description: 'This is a shiny string field',
          },
          deprecatedString: {
            type: GraphQLString,
            description: 'This is a deprecated string field',
            deprecationReason: 'Use shinyString',
          },
          color: {
            type: new GraphQLEnumType({
              name: 'Color',
              values: {
                RED: { description: 'So rosy' },
                GREEN: { description: 'So grassy' },
                BLUE: { description: 'So calming' },
                MAUVE: {
                  description: 'So sickening',
                  deprecationReason: 'No longer in fashion',
                },
              },
            }),
          },
        },
      }),
    });

    testSchema(schema);
  });

  it('can use client schema for limited execution', () => {
    const customScalar = new GraphQLScalarType({
      name: 'CustomScalar',
      serialize: () => null,
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          foo: {
            type: GraphQLString,
            args: {
              custom1: { type: customScalar },
              custom2: { type: customScalar },
            },
          },
        },
      }),
    });

    const introspection = introspectionFromSchema(schema);
    const clientSchema = buildClientSchema(introspection);

    const result = graphqlSync(
      clientSchema,
      'query Limited($v: CustomScalar) { foo(custom1: 123, custom2: $v) }',
      { foo: 'bar', unused: 'value' },
      null,
      { v: 'baz' },
    );

    expect(result.data).to.deep.equal({ foo: 'bar' });
  });

  describe('throws when given incomplete introspection', () => {
    it('throws when given empty types', () => {
      const incompleteIntrospection = {
        __schema: {
          queryType: { name: 'QueryType' },
          types: [],
        },
      };

      expect(() => buildClientSchema(incompleteIntrospection)).to.throw(
        'Invalid or incomplete schema, unknown type: QueryType. Ensure ' +
          'that a full introspection query is used in order to build a ' +
          'client schema.',
      );
    });

    it('throws when missing kind', () => {
      const incompleteIntrospection = {
        __schema: {
          queryType: { name: 'QueryType' },
          types: [{ name: 'QueryType' }],
        },
      };

      expect(() => buildClientSchema(incompleteIntrospection)).to.throw(
        'Invalid or incomplete introspection result. Ensure that a full ' +
          'introspection query is used in order to build a client schema',
      );
    });

    it('throws when missing interfaces', () => {
      const nullInterfaceIntrospection = {
        __schema: {
          queryType: { name: 'QueryType' },
          types: [
            {
              kind: 'OBJECT',
              name: 'QueryType',
              fields: [
                {
                  name: 'aString',
                  args: [],
                  type: { kind: 'SCALAR', name: 'String', ofType: null },
                  isDeprecated: false,
                },
              ],
            },
          ],
        },
      };

      expect(() => buildClientSchema(nullInterfaceIntrospection)).to.throw(
        'Introspection result missing interfaces: ' +
          '{ kind: "OBJECT", name: "QueryType", fields: [{ name: "aString", args: [], type: { kind: "SCALAR", name: "String", ofType: null }, isDeprecated: false }] }',
      );
    });

    it('throws when missing directive locations', () => {
      const introspection = {
        __schema: {
          types: [],
          directives: [{ name: 'test', args: [] }],
        },
      };

      expect(() => buildClientSchema(introspection)).to.throw(
        'Introspection result missing directive locations: ' +
          '{ name: "test", args: [] }',
      );
    });
  });

  describe('very deep decorators are not supported', () => {
    it('fails on very deep (> 7 levels) lists', () => {
      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            foo: {
              type: GraphQLList(
                GraphQLList(
                  GraphQLList(
                    GraphQLList(
                      GraphQLList(
                        GraphQLList(GraphQLList(GraphQLList(GraphQLString))),
                      ),
                    ),
                  ),
                ),
              ),
            },
          },
        }),
      });

      const introspection = introspectionFromSchema(schema);
      expect(() => buildClientSchema(introspection)).to.throw(
        'Decorated type deeper than introspection query.',
      );
    });

    it('fails on a very deep (> 7 levels) non-null', () => {
      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            foo: {
              type: GraphQLList(
                GraphQLNonNull(
                  GraphQLList(
                    GraphQLNonNull(
                      GraphQLList(
                        GraphQLNonNull(
                          GraphQLList(GraphQLNonNull(GraphQLString)),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            },
          },
        }),
      });

      const introspection = introspectionFromSchema(schema);
      expect(() => buildClientSchema(introspection)).to.throw(
        'Decorated type deeper than introspection query.',
      );
    });

    it('succeeds on deep (<= 7 levels) types', () => {
      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            foo: {
              // e.g., fully non-null 3D matrix
              type: GraphQLNonNull(
                GraphQLList(
                  GraphQLNonNull(
                    GraphQLList(
                      GraphQLNonNull(
                        GraphQLList(GraphQLNonNull(GraphQLString)),
                      ),
                    ),
                  ),
                ),
              ),
            },
          },
        }),
      });

      const introspection = introspectionFromSchema(schema);
      buildClientSchema(introspection);
    });
  });
});
