/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { buildClientSchema } from '../buildClientSchema';
import { introspectionQuery } from '../introspectionQuery';
import {
  graphql,
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
} from '../../';
import { GraphQLDirective } from '../../type/directives';


// Test property:
// Given a server's schema, a client may query that server with introspection,
// and use the result to produce a client-side representation of the schema
// by using "buildClientSchema". If the client then runs the introspection
// query against the client-side schema, it should get a result identical to
// what was returned by the server.
async function testSchema(serverSchema) {
  const initialIntrospection = await graphql(serverSchema, introspectionQuery);
  const clientSchema = buildClientSchema(initialIntrospection.data);
  const secondIntrospection = await graphql(clientSchema, introspectionQuery);
  expect(secondIntrospection).to.deep.equal(initialIntrospection);
}

describe('Type System: build schema from introspection', () => {

  it('builds a simple schema', async () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Simple',
        description: 'This is a simple type',
        fields: {
          string: {
            type: GraphQLString,
            description: 'This is a string field'
          }
        }
      })
    });

    await testSchema(schema);
  });

  it('builds a simple schema with all operation types', async () => {
    const queryType = new GraphQLObjectType({
      name: 'QueryType',
      description: 'This is a simple query type',
      fields: {
        string: {
          type: GraphQLString,
          description: 'This is a string field'
        }
      }
    });

    const mutationType = new GraphQLObjectType({
      name: 'MutationType',
      description: 'This is a simple mutation type',
      fields: {
        setString: {
          type: GraphQLString,
          description: 'Set the string field',
          args: {
            value: { type: GraphQLString }
          }
        }
      }
    });

    const subscriptionType = new GraphQLObjectType({
      name: 'SubscriptionType',
      description: 'This is a simple subscription type',
      fields: {
        string: {
          type: GraphQLString,
          description: 'This is a string field'
        }
      }
    });

    const schema = new GraphQLSchema({
      query: queryType,
      mutation: mutationType,
      subscription: subscriptionType
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
        }
      })
    });

    await testSchema(schema);

    const introspection = await graphql(schema, introspectionQuery);
    const clientSchema = buildClientSchema(introspection.data);

    // Built-ins are used
    expect(clientSchema.getType('Int')).to.equal(GraphQLInt);
    expect(clientSchema.getType('Float')).to.equal(GraphQLFloat);
    expect(clientSchema.getType('String')).to.equal(GraphQLString);
    expect(clientSchema.getType('Boolean')).to.equal(GraphQLBoolean);
    expect(clientSchema.getType('ID')).to.equal(GraphQLID);

    // Custom are built
    expect(clientSchema.getType('CustomScalar')).not.to.equal(customScalar);
  });

  it('builds a schema with a recursive type reference', async () => {
    const recurType = new GraphQLObjectType({
      name: 'Recur',
      fields: () => ({
        recur: { type: recurType }
      })
    });
    const schema = new GraphQLSchema({
      query: recurType
    });

    await testSchema(schema);
  });

  it('builds a schema with a circular type reference', async () => {
    const dogType = new GraphQLObjectType({
      name: 'Dog',
      fields: () => ({
        bestFriend: { type: humanType }
      })
    });
    const humanType = new GraphQLObjectType({
      name: 'Human',
      fields: () => ({
        bestFriend: { type: dogType }
      })
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Circular',
        fields: {
          dog: { type: dogType },
          human: { type: humanType }
        }
      })
    });

    await testSchema(schema);
  });

  it('builds a schema with an interface', async () => {
    const friendlyType = new GraphQLInterfaceType({
      name: 'Friendly',
      resolveType: () => null,
      fields: () => ({
        bestFriend: {
          type: friendlyType,
          description: 'The best friend of this friendly thing'
        }
      })
    });
    const dogType = new GraphQLObjectType({
      name: 'Dog',
      interfaces: [ friendlyType ],
      fields: () => ({
        bestFriend: { type: friendlyType }
      })
    });
    const humanType = new GraphQLObjectType({
      name: 'Human',
      interfaces: [ friendlyType ],
      fields: () => ({
        bestFriend: { type: friendlyType }
      })
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'WithInterface',
        fields: {
          friendly: { type: friendlyType }
        }
      }),
      types: [ dogType, humanType ]
    });

    await testSchema(schema);
  });

  it('builds a schema with an implicit interface', async () => {
    const friendlyType = new GraphQLInterfaceType({
      name: 'Friendly',
      resolveType: () => null,
      fields: () => ({
        bestFriend: {
          type: friendlyType,
          description: 'The best friend of this friendly thing'
        }
      })
    });
    const dogType = new GraphQLObjectType({
      name: 'Dog',
      interfaces: [ friendlyType ],
      fields: () => ({
        bestFriend: { type: dogType }
      })
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'WithInterface',
        fields: {
          dog: { type: dogType }
        }
      })
    });

    await testSchema(schema);
  });

  it('builds a schema with a union', async () => {
    const dogType = new GraphQLObjectType({
      name: 'Dog',
      fields: () => ({
        bestFriend: { type: friendlyType }
      })
    });
    const humanType = new GraphQLObjectType({
      name: 'Human',
      fields: () => ({
        bestFriend: { type: friendlyType }
      })
    });
    const friendlyType = new GraphQLUnionType({
      name: 'Friendly',
      resolveType: () => null,
      types: [ dogType, humanType ]
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'WithUnion',
        fields: {
          friendly: { type: friendlyType }
        }
      })
    });

    await testSchema(schema);
  });

  it('builds a schema with complex field values', async () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'ComplexFields',
        fields: {
          string: { type: GraphQLString },
          listOfString: { type: new GraphQLList(GraphQLString) },
          nonNullString: {
            type: new GraphQLNonNull(GraphQLString)
          },
          nonNullListOfString: {
            type: new GraphQLNonNull(new GraphQLList(GraphQLString))
          },
          nonNullListOfNonNullString: {
            type: new GraphQLNonNull(
              new GraphQLList(new GraphQLNonNull(GraphQLString))
            )
          },
        }
      })
    });

    await testSchema(schema);
  });

  it('builds a schema with field arguments', async () => {
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
                type: GraphQLInt
              }
            }
          },
          two: {
            description: 'A field with a two args',
            type: GraphQLString,
            args: {
              listArg: {
                description: 'This is an list of int arg',
                type: new GraphQLList(GraphQLInt)
              },
              requiredArg: {
                description: 'This is a required arg',
                type: new GraphQLNonNull(GraphQLBoolean)
              }
            }
          }
        }
      })
    });

    await testSchema(schema);
  });

  it('builds a schema with an enum', async () => {
    const foodEnum = new GraphQLEnumType({
      name: 'Food',
      description: 'Varieties of food stuffs',
      values: {
        VEGETABLES: {
          description: 'Foods that are vegetables.',
          value: 1
        },
        FRUITS: {
          description: 'Foods that are fruits.',
          value: 2
        },
        OILS: {
          description: 'Foods that are oils.',
          value: 3
        },
        DAIRY: {
          description: 'Foods that are dairy.',
          value: 4
        },
        MEAT: {
          description: 'Foods that are meat.',
          value: 5
        }
      }
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
                type: foodEnum
              }
            }
          }
        }
      })
    });

    await testSchema(schema);

    const introspection = await graphql(schema, introspectionQuery);
    const clientSchema = buildClientSchema(introspection.data);
    const clientFoodEnum = clientSchema.getType('Food');

    // It's also an Enum type on the client.
    expect(clientFoodEnum).to.be.an.instanceOf(GraphQLEnumType);

    // Client types do not get server-only values, so `value` mirrors `name`,
    // rather than using the integers defined in the "server" schema.
    expect(clientFoodEnum.getValues()).to.deep.equal([
      { name: 'VEGETABLES',
        value: 'VEGETABLES',
        description: 'Foods that are vegetables.',
        deprecationReason: null, },
      { name: 'FRUITS',
        value: 'FRUITS',
        description: 'Foods that are fruits.',
        deprecationReason: null, },
      { name: 'OILS',
        value: 'OILS',
        description: 'Foods that are oils.',
        deprecationReason: null, },
      { name: 'DAIRY',
        value: 'DAIRY',
        description: 'Foods that are dairy.',
        deprecationReason: null, },
      { name: 'MEAT',
        value: 'MEAT',
        description: 'Foods that are meat.',
        deprecationReason: null, },
    ]);
  });

  it('builds a schema with an input object', async () => {
    const addressType = new GraphQLInputObjectType({
      name: 'Address',
      description: 'An input address',
      fields: {
        street: {
          description: 'What street is this address?',
          type: new GraphQLNonNull(GraphQLString)
        },
        city: {
          description: 'The city the address is within?',
          type: new GraphQLNonNull(GraphQLString)
        },
        country: {
          description: 'The country (blank will assume USA).',
          type: GraphQLString,
          defaultValue: 'USA'
        }
      }
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
                type: addressType
              }
            }
          }
        }
      })
    });

    await testSchema(schema);
  });


  it('builds a schema with field arguments with default values', async () => {
    const geoType = new GraphQLInputObjectType({
      name: 'Geo',
      fields: {
        lat: { type: GraphQLFloat },
        lon: { type: GraphQLFloat },
      }
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
                defaultValue: 10
              }
            }
          },
          defaultList: {
            type: GraphQLString,
            args: {
              listArg: {
                type: new GraphQLList(GraphQLInt),
                defaultValue: [ 1, 2, 3 ]
              }
            }
          },
          defaultObject: {
            type: GraphQLString,
            args: {
              objArg: {
                type: geoType,
                defaultValue: { lat: 37.485, lon: -122.148 }
              }
            }
          }
        }
      })
    });

    await testSchema(schema);
  });

  it('builds a schema with custom directives', async () => {

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Simple',
        description: 'This is a simple type',
        fields: {
          string: {
            type: GraphQLString,
            description: 'This is a string field'
          }
        }
      }),
      directives: [
        new GraphQLDirective({
          name: 'customDirective',
          description: 'This is a custom directive',
          locations: [ 'FIELD' ],
        })
      ]
    });

    await testSchema(schema);
  });

  it('builds a schema with legacy directives', async () => {

    const oldIntrospection = {
      __schema: {
        // Minimum required schema.
        queryType: {
          name: 'Simple'
        },
        types: [ {
          name: 'Simple',
          kind: 'OBJECT',
          fields: [ {
            name: 'simple',
            args: [],
            type: { name: 'Simple' }
          } ],
          interfaces: []
        } ],
        // Test old directive introspection results.
        directives: [
          { name: 'Old1', args: [], onField: true },
          { name: 'Old2', args: [], onFragment: true },
          { name: 'Old3', args: [], onOperation: true },
          { name: 'Old4', args: [], onField: true, onFragment: true },
        ]
      }
    };

    // New introspection produces correct new format.
    const newIntrospection = {
      __schema: {
        directives: [
          {
            name: 'Old1',
            args: [],
            locations: [ 'FIELD' ]
          },
          {
            name: 'Old2',
            args: [],
            locations: [
              'FRAGMENT_DEFINITION',
              'FRAGMENT_SPREAD',
              'INLINE_FRAGMENT'
            ]
          },
          {
            name: 'Old3',
            args: [],
            locations: [ 'QUERY', 'MUTATION', 'SUBSCRIPTION' ]
          },
          {
            name: 'Old4',
            args: [],
            locations: [
              'FIELD',
              'FRAGMENT_DEFINITION',
              'FRAGMENT_SPREAD',
              'INLINE_FRAGMENT'
            ]
          },
        ]
      }
    };

    const clientSchema = buildClientSchema(oldIntrospection);
    const secondIntrospection = await graphql(clientSchema, introspectionQuery);
    expect(secondIntrospection.data).to.containSubset(newIntrospection);
  });

  it('builds a schema aware of deprecation', async () => {

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Simple',
        description: 'This is a simple type',
        fields: {
          shinyString: {
            type: GraphQLString,
            description: 'This is a shiny string field'
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
                  deprecationReason: 'No longer in fashion'
                },
              }
            })
          }
        }
      })
    });

    await testSchema(schema);
  });

  it('cannot use client schema for general execution', async () => {
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
              custom2: { type: customScalar }
            }
          }
        }
      })
    });

    const introspection = await graphql(schema, introspectionQuery);
    const clientSchema = buildClientSchema(introspection.data);

    const result = await graphql(
      clientSchema,
      'query NoNo($v: CustomScalar) { foo(custom1: 123, custom2: $v) }',
      { foo: 'bar' },
      null,
      { v: 'baz' }
    );
    expect(result).to.containSubset({
      data: {
        foo: null,
      },
      errors: [
        { message: 'Client Schema cannot be used for execution.',
          locations: [ { line: 1, column: 32 } ] }
      ]
    });
  });

  describe('throws when given incomplete introspection', () => {

    it('throws when given empty types', () => {
      const incompleteIntrospection = {
        __schema: {
          queryType: { name: 'QueryType' },
          types: []
        }
      };

      expect(
        () => buildClientSchema(incompleteIntrospection)
      ).to.throw(
        'Invalid or incomplete schema, unknown type: QueryType. Ensure ' +
        'that a full introspection query is used in order to build a ' +
        'client schema.'
      );
    });

    it('throws when missing kind', () => {
      const incompleteIntrospection = {
        __schema: {
          queryType: { name: 'QueryType' },
          types: [
            { name: 'QueryType' }
          ]
        }
      };

      expect(
        () => buildClientSchema(incompleteIntrospection)
      ).to.throw(
        'Invalid or incomplete schema, unknown kind: undefined. Ensure ' +
        'that a full introspection query is used in order to build a ' +
        'client schema.'
      );
    });

  });

  describe('very deep decorators are not supported', () => {

    it('fails on very deep (> 7 levels) lists', async () => {
      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            foo: {
              type: new GraphQLList(new GraphQLList(new GraphQLList(
                new GraphQLList(new GraphQLList(new GraphQLList(
                new GraphQLList(new GraphQLList(GraphQLString))
              ))))))
            }
          }
        })
      });

      const introspection = await graphql(schema, introspectionQuery);
      expect(
        () => buildClientSchema(introspection.data)
      ).to.throw('Decorated type deeper than introspection query.');
    });

    it('fails on a very deep (> 7 levels) non-null', async () => {
      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            foo: {
              type: new GraphQLList(new GraphQLNonNull(new GraphQLList(
                new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(
                new GraphQLList(new GraphQLNonNull(GraphQLString))
              ))))))
            }
          }
        })
      });

      const introspection = await graphql(schema, introspectionQuery);
      expect(
        () => buildClientSchema(introspection.data)
      ).to.throw('Decorated type deeper than introspection query.');
    });

    it('succeeds on deep (<= 7 levels) types', async () => {
      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            foo: {
              // e.g., fully non-null 3D matrix
              type: new GraphQLNonNull(new GraphQLList(
                new GraphQLNonNull(new GraphQLList(
                new GraphQLNonNull(new GraphQLList(
                new GraphQLNonNull(GraphQLString)
              ))))))
            }
          }
        })
      });

      const introspection = await graphql(schema, introspectionQuery);
      buildClientSchema(introspection.data);
    });

  });

});
