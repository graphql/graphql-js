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
import { introspectionQuery } from '../../type/introspectionQuery';
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


// Test property:
// Given a server's schema, a client may query that server with introspection,
// and use the result to produce a client-side representation of the schema
// by using "buildClientSchema". If the client then runs the introspection
// query against the client-side schema, it should get a result identical to
// what was returned by the server.
async function testSchema(serverSchema) {
  var initialIntrospection = await graphql(serverSchema, introspectionQuery);
  var clientSchema = buildClientSchema(initialIntrospection.data);
  var secondIntrospection = await graphql(clientSchema, introspectionQuery);
  expect(secondIntrospection).to.deep.equal(initialIntrospection);
}

describe('Type System: build schema from introspection', () => {

  it('builds a simple schema', async () => {
    var schema = new GraphQLSchema({
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

  it('builds a simple schema with a mutation type', async () => {
    var queryType = new GraphQLObjectType({
      name: 'QueryType',
      description: 'This is a simple query type',
      fields: {
        string: {
          type: GraphQLString,
          description: 'This is a string field'
        }
      }
    });

    var mutationType = new GraphQLObjectType({
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

    var schema = new GraphQLSchema({
      query: queryType,
      mutation: mutationType
    });

    await testSchema(schema);
  });

  it('uses built-in scalars when possible', async () => {
    var customScalar = new GraphQLScalarType({
      name: 'CustomScalar'
    });
    var schema = new GraphQLSchema({
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

    var introspection = await graphql(schema, introspectionQuery);
    var clientSchema = buildClientSchema(introspection.data);

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
    var recurType = new GraphQLObjectType({
      name: 'Recur',
      fields: () => ({
        recur: { type: recurType }
      })
    });
    var schema = new GraphQLSchema({
      query: recurType
    });

    await testSchema(schema);
  });

  it('builds a schema with a circular type reference', async () => {
    var dogType = new GraphQLObjectType({
      name: 'Dog',
      fields: () => ({
        bestFriend: { type: humanType }
      })
    });
    var humanType = new GraphQLObjectType({
      name: 'Human',
      fields: () => ({
        bestFriend: { type: dogType }
      })
    });
    var schema = new GraphQLSchema({
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
    var friendlyType = new GraphQLInterfaceType({
      name: 'Friendly',
      fields: () => ({
        bestFriend: {
          type: friendlyType,
          description: 'The best friend of this friendly thing'
        }
      })
    });
    /* eslint-disable no-new */
    new GraphQLObjectType({
      name: 'Dog',
      interfaces: [friendlyType],
      fields: () => ({
        bestFriend: { type: friendlyType }
      })
    });
    new GraphQLObjectType({
      name: 'Human',
      interfaces: [friendlyType],
      fields: () => ({
        bestFriend: { type: friendlyType }
      })
    });
    /* eslint-enable no-new */
    var schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'WithInterface',
        fields: {
          friendly: { type: friendlyType }
        }
      })
    });

    await testSchema(schema);
  });

  it('builds a schema with a union', async () => {
    var dogType = new GraphQLObjectType({
      name: 'Dog',
      fields: () => ({
        bestFriend: { type: friendlyType }
      })
    });
    var humanType = new GraphQLObjectType({
      name: 'Human',
      fields: () => ({
        bestFriend: { type: friendlyType }
      })
    });
    var friendlyType = new GraphQLUnionType({
      name: 'Friendly',
      types: [dogType, humanType]
    });
    var schema = new GraphQLSchema({
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
    var schema = new GraphQLSchema({
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
    var schema = new GraphQLSchema({
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
    var foodEnum = new GraphQLEnumType({
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
    var schema = new GraphQLSchema({
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

    var introspection = await graphql(schema, introspectionQuery);
    var clientSchema = buildClientSchema(introspection.data);
    var clientFoodEnum = clientSchema.getType('Food');

    // It's also an Enum type on the client.
    expect(clientFoodEnum).to.be.an.instanceOf(GraphQLEnumType);

    // Client types do not get server-only values, so `value` mirrors `name`,
    // rather than using the integers defined in the "server" schema.
    expect(clientFoodEnum.getValues()).to.deep.equal({
      DAIRY: {
        description: 'Foods that are dairy.',
        name: 'DAIRY',
        value: 'DAIRY',
      },
      FRUITS: {
        description: 'Foods that are fruits.',
        name: 'FRUITS',
        value: 'FRUITS',
      },
      MEAT: {
        description: 'Foods that are meat.',
        name: 'MEAT',
        value: 'MEAT',
      },
      OILS: {
        description: 'Foods that are oils.',
        name: 'OILS',
        value: 'OILS',
      },
      VEGETABLES: {
        description: 'Foods that are vegetables.',
        name: 'VEGETABLES',
        value: 'VEGETABLES',
      },
    });
  });

  it('builds a schema with an input object', async () => {
    var addressType = new GraphQLInputObjectType({
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
    var schema = new GraphQLSchema({
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
    var geoType = new GraphQLInputObjectType({
      name: 'Geo',
      fields: {
        lat: { type: GraphQLFloat },
        lon: { type: GraphQLFloat },
      }
    });

    var schema = new GraphQLSchema({
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
                defaultValue: [1, 2, 3]
              }
            }
          },
          defaultObject: {
            type: GraphQLString,
            args: {
              objArg: {
                type: geoType,
                defaultValue: {lat: 37.485, lon: -122.148}
              }
            }
          }
        }
      })
    });

    await testSchema(schema);
  });

  it('cannot use client schema for general execution', async () => {
    var customScalar = new GraphQLScalarType({
      name: 'CustomScalar'
    });

    var schema = new GraphQLSchema({
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

    var introspection = await graphql(schema, introspectionQuery);
    var clientSchema = buildClientSchema(introspection.data);

    var result = await graphql(
      clientSchema,
      'query NoNo($v: CustomScalar) { foo(custom1: 123, custom2: $v) }',
      { foo: 'bar' },
      { v: 'baz' }
    );
    expect(result).to.deep.equal({
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
      var incompleteIntrospection = {
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
      var incompleteIntrospection = {
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

  describe('KP: very deep decorators are not supported', () => {

    it('fails on very deep lists', async () => {
      var schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            foo: {
              type: new GraphQLList(new GraphQLList(new GraphQLList(
                new GraphQLList(GraphQLString)
              )))
            }
          }
        })
      });

      var introspection = await graphql(schema, introspectionQuery);
      expect(
        () => buildClientSchema(introspection.data)
      ).to.throw('Decorated type deeper than introspection query.');
    });

    it('fails on a deep non-null', async () => {
      var schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            foo: {
              type: new GraphQLList(new GraphQLList(new GraphQLList(
                new GraphQLNonNull(GraphQLString)
              )))
            }
          }
        })
      });

      var introspection = await graphql(schema, introspectionQuery);
      expect(
        () => buildClientSchema(introspection.data)
      ).to.throw('Decorated type deeper than introspection query.');
    });

  });

});
