/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { introspectionQuery } from '../introspectionQuery';
import { introspectionQueryFromGraphQLSchema } from '../introspectionFromSchema';
import { cleanIntrospectionResponse } from '../cleanIntrospectionResponse';
import {
  graphql,
  GraphQLID,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInt,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLDirective,
} from '../..';

// Test property:
// Given a server's schema, a client querying the introspectionQuery returns
// an uncleaned response that, once cleaned, exactly matches the direct
// GraphQLSchema => IntrospectionQuery conversion
async function testSchema(schema) {
  const serverResponse = await graphql(schema, introspectionQuery);
  const serverIntrospection = cleanIntrospectionResponse(serverResponse.data);
  const introspectionFromSchema = introspectionQueryFromGraphQLSchema(schema);
  expect(introspectionFromSchema).to.deep.equal(serverIntrospection);
}

describe('Type System: build introspection from schema', () => {
  it('converts a simple schema', async () => {
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

    await testSchema(schema);
  });

  it('converts a simple schema with all operation types', async () => {
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

    await testSchema(schema);
  });

  it('uses built-in scalars when possible', async () => {
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

    await testSchema(schema);
  });

  it('converts a schema with a recursive type reference', async () => {
    const recurType = new GraphQLObjectType({
      name: 'Recur',
      fields: () => ({
        recur: { type: recurType },
      }),
    });
    const schema = new GraphQLSchema({
      query: recurType,
    });

    await testSchema(schema);
  });

  it('converts a schema with a circular type reference', async () => {
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

    await testSchema(schema);
  });

  it('converts a schema with an interface', async () => {
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

    await testSchema(schema);
  });

  it('converts a schema with an implicit interface', async () => {
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

    await testSchema(schema);
  });

  it('converts a schema with a union', async () => {
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

    await testSchema(schema);
  });

  it('converts a schema with complex field values', async () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'ComplexFields',
        fields: {
          string: { type: GraphQLString },
          listOfString: { type: new GraphQLList(GraphQLString) },
          nonNullString: {
            type: new GraphQLNonNull(GraphQLString),
          },
          nonNullListOfString: {
            type: new GraphQLNonNull(new GraphQLList(GraphQLString)),
          },
          nonNullListOfNonNullString: {
            type: new GraphQLNonNull(
              new GraphQLList(new GraphQLNonNull(GraphQLString)),
            ),
          },
        },
      }),
    });

    await testSchema(schema);
  });

  it('converts a schema with field arguments', async () => {
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
                type: new GraphQLList(GraphQLInt),
              },
              requiredArg: {
                description: 'This is a required arg',
                type: new GraphQLNonNull(GraphQLBoolean),
              },
            },
          },
        },
      }),
    });

    await testSchema(schema);
  });

  it('converts a schema with default value on custom scalar field', async () => {
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

    await testSchema(schema);
  });

  it('converts a schema with an enum', async () => {
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

    await testSchema(schema);
  });

  it('converts a schema with an input object', async () => {
    const addressType = new GraphQLInputObjectType({
      name: 'Address',
      description: 'An input address',
      fields: {
        street: {
          description: 'What street is this address?',
          type: new GraphQLNonNull(GraphQLString),
        },
        city: {
          description: 'The city the address is within?',
          type: new GraphQLNonNull(GraphQLString),
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

    await testSchema(schema);
  });

  it('converts a schema with field arguments with default values', async () => {
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
                type: new GraphQLList(GraphQLInt),
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

    await testSchema(schema);
  });

  it('converts a schema with custom directives', async () => {
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

    await testSchema(schema);
  });

  it('converts a schema aware of deprecation', async () => {
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

    await testSchema(schema);
  });

  describe('very deep decorators', () => {
    it('succeeds on deep (<= 7 levels) types', async () => {
      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            foo: {
              // e.g., fully non-null 3D matrix
              type: new GraphQLNonNull(
                new GraphQLList(
                  new GraphQLNonNull(
                    new GraphQLList(
                      new GraphQLNonNull(
                        new GraphQLList(new GraphQLNonNull(GraphQLString)),
                      ),
                    ),
                  ),
                ),
              ),
            },
          },
        }),
      });

      await testSchema(schema);
    });
  });
});
