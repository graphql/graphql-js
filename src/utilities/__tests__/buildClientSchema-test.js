/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import dedent from '../../jsutils/dedent';
import invariant from '../../jsutils/invariant';
import { buildClientSchema } from '../buildClientSchema';
import { introspectionFromSchema } from '../introspectionFromSchema';
import {
  buildSchema,
  printSchema,
  graphqlSync,
  isEnumType,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLBoolean,
  GraphQLID,
} from '../../';

/**
 * This function does a full cycle of going from a string with the contents of
 * the SDL, build in-memory GraphQLSchema from it, produce a client-side
 * representation of the schema by using "buildClientSchema"and then finally
 * printing that that schema into the SDL
 */
function cycleIntrospection(sdlString) {
  const serverSchema = buildSchema(sdlString);
  const initialIntrospection = introspectionFromSchema(serverSchema);
  const clientSchema = buildClientSchema(initialIntrospection);
  const secondIntrospection = introspectionFromSchema(clientSchema);

  /**
   * If the client then runs the introspection query against the client-side
   * schema, it should get a result identical to what was returned by the server
   */
  expect(secondIntrospection).to.deep.equal(initialIntrospection);
  return printSchema(clientSchema);
}

describe('Type System: build schema from introspection', () => {
  it('builds a simple schema', () => {
    const sdl = dedent`
      schema {
        query: Simple
      }

      """This is simple type"""
      type Simple {
        """This is a string field"""
        string: String
      }
    `;

    expect(cycleIntrospection(sdl)).to.equal(sdl);
  });

  it('builds a simple schema with all operation types', () => {
    const sdl = dedent`
      schema {
        query: QueryType
        mutation: MutationType
        subscription: SubscriptionType
      }

      """This is a simple mutation type"""
      type MutationType {
        """Set the string field"""
        string: String
      }

      """This is a simple query type"""
      type QueryType {
        """This is a string field"""
        string: String
      }

      """This is a simple subscription type"""
      type SubscriptionType {
        """This is a string field"""
        string: String
      }
    `;

    expect(cycleIntrospection(sdl)).to.equal(sdl);
  });

  it('uses built-in scalars when possible', () => {
    const sdl = dedent`
      scalar CustomScalar

      type Query {
        int: Int
        float: Float
        string: String
        boolean: Boolean
        id: ID
        custom: CustomScalar
      }
    `;

    expect(cycleIntrospection(sdl)).to.equal(sdl);

    const schema = buildSchema(sdl);
    const introspection = introspectionFromSchema(schema);
    const clientSchema = buildClientSchema(introspection);

    // Built-ins are used
    expect(clientSchema.getType('Int')).to.equal(GraphQLInt);
    expect(clientSchema.getType('Float')).to.equal(GraphQLFloat);
    expect(clientSchema.getType('String')).to.equal(GraphQLString);
    expect(clientSchema.getType('Boolean')).to.equal(GraphQLBoolean);
    expect(clientSchema.getType('ID')).to.equal(GraphQLID);

    // Custom are built
    const customScalar = schema.getType('CustomScalar');
    expect(clientSchema.getType('CustomScalar')).not.to.equal(customScalar);
  });

  it('include standard type only if it is used', () => {
    const schema = buildSchema(`
      type Query {
        foo: String
      }
    `);
    const introspection = introspectionFromSchema(schema);
    const clientSchema = buildClientSchema(introspection);

    expect(clientSchema.getType('Int')).to.equal(undefined);
    expect(clientSchema.getType('Float')).to.equal(undefined);
    expect(clientSchema.getType('ID')).to.equal(undefined);
  });

  it('builds a schema with a recursive type reference', () => {
    const sdl = dedent`
      schema {
        query: Recur
      }

      type Recur {
        recur: Recur
      }
    `;

    expect(cycleIntrospection(sdl)).to.equal(sdl);
  });

  it('builds a schema with a circular type reference', () => {
    const sdl = dedent`
      type Dog {
        bestFriend: Human
      }

      type Human {
        bestFriend: Dog
      }

      type Query {
        dog: Dog
        human: Human
      }
    `;

    expect(cycleIntrospection(sdl)).to.equal(sdl);
  });

  it('builds a schema with an interface', () => {
    const sdl = dedent`
      type Dog implements Friendly {
        bestFriend: Friendly
      }

      interface Friendly {
        """The best friend of this friendly thing"""
        bestFriend: Friendly
      }

      type Human implements Friendly {
        bestFriend: Friendly
      }

      type Query {
        friendly: Friendly
      }
    `;

    expect(cycleIntrospection(sdl)).to.equal(sdl);
  });

  it('builds a schema with an implicit interface', () => {
    const sdl = dedent`
      type Dog implements Friendly {
        bestFriend: Friendly
      }

      interface Friendly {
        """The best friend of this friendly thing"""
        bestFriend: Friendly
      }

      type Query {
        dog: Dog
      }
    `;

    expect(cycleIntrospection(sdl)).to.equal(sdl);
  });

  it('builds a schema with a union', () => {
    const sdl = dedent`
      type Dog {
        bestFriend: Friendly
      }

      union Friendly = Dog | Human

      type Human {
        bestFriend: Friendly
      }

      type Query {
        friendly: Friendly
      }
    `;

    expect(cycleIntrospection(sdl)).to.equal(sdl);
  });

  it('builds a schema with complex field values', () => {
    const sdl = dedent`
      type Query {
        string: String
        listOfString: [String]
        nonNullString: String!
        nonNullListOfString: [String]!
        nonNullListOfNonNullString: [String!]!
      }
    `;

    expect(cycleIntrospection(sdl)).to.equal(sdl);
  });

  it('builds a schema with field arguments', () => {
    const sdl = dedent`
      type Query {
        """A field with a single arg"""
        one(
          """This is an int arg"""
          intArg: Int
        ): String

        """A field with a two args"""
        two(
          """This is an list of int arg"""
          listArg: [Int]

          """This is a required arg"""
          requiredArg: Boolean!
        ): String
      }
    `;

    expect(cycleIntrospection(sdl)).to.equal(sdl);
  });

  it('builds a schema with default value on custom scalar field', () => {
    const sdl = dedent`
      scalar CustomScalar

      type Query {
        testField(testArg: CustomScalar = "default"): String
      }
    `;

    expect(cycleIntrospection(sdl)).to.equal(sdl);
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

    const introspection = introspectionFromSchema(schema);
    const clientSchema = buildClientSchema(introspection);

    const secondIntrospection = introspectionFromSchema(clientSchema);
    expect(secondIntrospection).to.deep.equal(introspection);

    const clientFoodEnum = clientSchema.getType('Food');

    // It's also an Enum type on the client.
    invariant(isEnumType(clientFoodEnum));

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
    const sdl = dedent`
      """An input address"""
      input Address {
        """What street is this address?"""
        street: String!

        """The city the address is within?"""
        city: String!

        """The country (blank will assume USA)."""
        country: String = "USA"
      }

      type Query {
        """Get a geocode from an address"""
        geocode(
          """The address to lookup"""
          address: Address
        ): String
      }
    `;

    expect(cycleIntrospection(sdl)).to.equal(sdl);
  });

  it('builds a schema with field arguments with default values', () => {
    const sdl = dedent`
      input Geo {
        lat: Float
        lon: Float
      }

      type Query {
        defaultInt(intArg: Int = 30): String
        defaultList(listArg: [Int] = [1, 2, 3]): String
        defaultObject(objArg: Geo = {lat: 37.485, lon: -122.148}): String
        defaultNull(intArg: Int = null): String
        noDefault(intArg: Int): String
      }
    `;

    expect(cycleIntrospection(sdl)).to.equal(sdl);
  });

  it('builds a schema with custom directives', () => {
    const sdl = dedent`
      """This is a custom directive"""
      directive @customDirective on FIELD

      type Query {
        string: String
      }
    `;

    expect(cycleIntrospection(sdl)).to.equal(sdl);
  });

  it('builds a schema with legacy names', () => {
    const sdl = dedent`
      type Query {
        __badName: String
      }
    `;
    const allowedLegacyNames = ['__badName'];
    const schema = buildSchema(sdl, { allowedLegacyNames });

    const introspection = introspectionFromSchema(schema);
    const clientSchema = buildClientSchema(introspection, {
      allowedLegacyNames,
    });

    expect(schema.__allowedLegacyNames).to.deep.equal(['__badName']);
    expect(printSchema(clientSchema)).to.equal(sdl);
  });

  it('builds a schema aware of deprecation', () => {
    const sdl = dedent`
      enum Color {
        """So rosy"""
        RED

        """So grassy"""
        GREEN

        """So calming"""
        BLUE

        """So sickening"""
        MAUVE @deprecated(reason: "No longer in fashion")
      }

      type Query {
        """This is a shiny string field"""
        shinyString: String

        """This is a deprecated string field"""
        deprecatedString: String @deprecated(reason: "Use shinyString")
        color: Color
      }
    `;

    expect(cycleIntrospection(sdl)).to.equal(sdl);
  });

  it('can use client schema for limited execution', () => {
    const schema = buildSchema(`
      scalar CustomScalar

      type Query {
        foo(custom1: CustomScalar, custom2: CustomScalar): String
      }
    `);

    const introspection = introspectionFromSchema(schema);
    const clientSchema = buildClientSchema(introspection);

    const result = graphqlSync({
      schema: clientSchema,
      source:
        'query Limited($v: CustomScalar) { foo(custom1: 123, custom2: $v) }',
      rootValue: { foo: 'bar', unused: 'value' },
      variableValues: { v: 'baz' },
    });

    expect(result.data).to.deep.equal({ foo: 'bar' });
  });

  describe('throws when given invalid introspection', () => {
    const dummySchema = buildSchema(`
      type Query {
        foo(bar: String): String
      }

      union SomeUnion = Query

      enum SomeEnum { FOO }

      input SomeInputObject {
        foo: String
      }

      directive @SomeDirective on QUERY
    `);

    it('throws when referenced unknown type', () => {
      const introspection = introspectionFromSchema(dummySchema);

      // $DisableFlowOnNegativeTest
      introspection.__schema.types = introspection.__schema.types.filter(
        ({ name }) => name !== 'Query',
      );

      expect(() => buildClientSchema(introspection)).to.throw(
        'Invalid or incomplete schema, unknown type: Query. Ensure that a full introspection query is used in order to build a client schema.',
      );
    });

    it('throws when type reference is missing name', () => {
      const introspection = introspectionFromSchema(dummySchema);

      expect(introspection).to.have.nested.property('__schema.queryType.name');
      delete introspection.__schema.queryType.name;

      expect(() => buildClientSchema(introspection)).to.throw(
        'Unknown type reference: {}',
      );
    });

    it('throws when missing kind', () => {
      const introspection = introspectionFromSchema(dummySchema);
      const queryTypeIntrospection = introspection.__schema.types.find(
        ({ name }) => name === 'Query',
      );

      expect(queryTypeIntrospection).to.have.property('kind');
      // $DisableFlowOnNegativeTest
      delete queryTypeIntrospection.kind;

      expect(() => buildClientSchema(introspection)).to.throw(
        'Invalid or incomplete introspection result. Ensure that a full introspection query is used in order to build a client schema',
      );
    });

    it('throws when missing interfaces', () => {
      const introspection = introspectionFromSchema(dummySchema);
      const queryTypeIntrospection = introspection.__schema.types.find(
        ({ name }) => name === 'Query',
      );

      expect(queryTypeIntrospection).to.have.property('interfaces');
      // $DisableFlowOnNegativeTest
      delete queryTypeIntrospection.interfaces;

      expect(() => buildClientSchema(introspection)).to.throw(
        'Introspection result missing interfaces: { kind: "OBJECT", name: "Query",',
      );
    });

    it('throws when missing fields', () => {
      const introspection = introspectionFromSchema(dummySchema);
      const queryTypeIntrospection = introspection.__schema.types.find(
        ({ name }) => name === 'Query',
      );

      expect(queryTypeIntrospection).to.have.property('fields');
      // $DisableFlowOnNegativeTest
      delete queryTypeIntrospection.fields;

      expect(() => buildClientSchema(introspection)).to.throw(
        'Introspection result missing fields: { kind: "OBJECT", name: "Query",',
      );
    });

    it('throws when missing field args', () => {
      const introspection = introspectionFromSchema(dummySchema);
      const queryTypeIntrospection = introspection.__schema.types.find(
        ({ name }) => name === 'Query',
      );

      expect(queryTypeIntrospection).to.have.nested.property('fields[0].args');
      // $DisableFlowOnNegativeTest
      delete queryTypeIntrospection.fields[0].args;

      expect(() => buildClientSchema(introspection)).to.throw(
        'Introspection result missing field args: { name: "foo",',
      );
    });

    it('throws when output type is used as an arg type', () => {
      const introspection = introspectionFromSchema(dummySchema);
      const queryTypeIntrospection = introspection.__schema.types.find(
        ({ name }) => name === 'Query',
      );

      expect(queryTypeIntrospection).to.have.nested.property(
        'fields[0].args[0].type.name',
        'String',
      );
      // $DisableFlowOnNegativeTest
      queryTypeIntrospection.fields[0].args[0].type.name = 'SomeUnion';

      expect(() => buildClientSchema(introspection)).to.throw(
        'Introspection must provide input type for arguments, but received: SomeUnion.',
      );
    });

    it('throws when input type is used as a field type', () => {
      const introspection = introspectionFromSchema(dummySchema);
      const queryTypeIntrospection = introspection.__schema.types.find(
        ({ name }) => name === 'Query',
      );

      expect(queryTypeIntrospection).to.have.nested.property(
        'fields[0].type.name',
        'String',
      );
      // $DisableFlowOnNegativeTest
      queryTypeIntrospection.fields[0].type.name = 'SomeInputObject';

      expect(() => buildClientSchema(introspection)).to.throw(
        'Introspection must provide output type for fields, but received: SomeInputObject.',
      );
    });

    it('throws when missing possibleTypes', () => {
      const introspection = introspectionFromSchema(dummySchema);
      const someUnionIntrospection = introspection.__schema.types.find(
        ({ name }) => name === 'SomeUnion',
      );

      expect(someUnionIntrospection).to.have.property('possibleTypes');
      // $DisableFlowOnNegativeTest
      delete someUnionIntrospection.possibleTypes;

      expect(() => buildClientSchema(introspection)).to.throw(
        'Introspection result missing possibleTypes: { kind: "UNION", name: "SomeUnion",',
      );
    });

    it('throws when missing enumValues', () => {
      const introspection = introspectionFromSchema(dummySchema);
      const someEnumIntrospection = introspection.__schema.types.find(
        ({ name }) => name === 'SomeEnum',
      );

      expect(someEnumIntrospection).to.have.property('enumValues');
      // $DisableFlowOnNegativeTest
      delete someEnumIntrospection.enumValues;

      expect(() => buildClientSchema(introspection)).to.throw(
        'Introspection result missing enumValues: { kind: "ENUM", name: "SomeEnum",',
      );
    });

    it('throws when missing inputFields', () => {
      const introspection = introspectionFromSchema(dummySchema);
      const someInputObjectIntrospection = introspection.__schema.types.find(
        ({ name }) => name === 'SomeInputObject',
      );

      expect(someInputObjectIntrospection).to.have.property('inputFields');
      // $DisableFlowOnNegativeTest
      delete someInputObjectIntrospection.inputFields;

      expect(() => buildClientSchema(introspection)).to.throw(
        'Introspection result missing inputFields: { kind: "INPUT_OBJECT", name: "SomeInputObject",',
      );
    });

    it('throws when missing directive locations', () => {
      const introspection = introspectionFromSchema(dummySchema);

      const someDirectiveIntrospection = introspection.__schema.directives[0];
      expect(someDirectiveIntrospection).to.deep.include({
        name: 'SomeDirective',
        locations: ['QUERY'],
      });
      delete someDirectiveIntrospection.locations;

      expect(() => buildClientSchema(introspection)).to.throw(
        'Introspection result missing directive locations: { name: "SomeDirective",',
      );
    });

    it('throws when missing directive args', () => {
      const introspection = introspectionFromSchema(dummySchema);

      const someDirectiveIntrospection = introspection.__schema.directives[0];
      expect(someDirectiveIntrospection).to.deep.include({
        name: 'SomeDirective',
        args: [],
      });
      delete someDirectiveIntrospection.args;

      expect(() => buildClientSchema(introspection)).to.throw(
        'Introspection result missing directive args: { name: "SomeDirective",',
      );
    });
  });

  describe('very deep decorators are not supported', () => {
    it('fails on very deep (> 7 levels) lists', () => {
      const schema = buildSchema(`
        type Query {
          foo: [[[[[[[[String]]]]]]]]
        }
      `);

      const introspection = introspectionFromSchema(schema);
      expect(() => buildClientSchema(introspection)).to.throw(
        'Decorated type deeper than introspection query.',
      );
    });

    it('fails on a very deep (> 7 levels) non-null', () => {
      const schema = buildSchema(`
        type Query {
          foo: [[[[String!]!]!]!]
        }
      `);

      const introspection = introspectionFromSchema(schema);
      expect(() => buildClientSchema(introspection)).to.throw(
        'Decorated type deeper than introspection query.',
      );
    });

    it('succeeds on deep (<= 7 levels) types', () => {
      // e.g., fully non-null 3D matrix
      const sdl = dedent`
        type Query {
          foo: [[[String!]!]!]!
        }
      `;

      expect(cycleIntrospection(sdl)).to.equal(sdl);
    });
  });

  describe('prevents infinite recursion on invalid introspection', () => {
    it('recursive interfaces', () => {
      const sdl = `
        type Query {
          foo: Foo
        }

        type Foo implements Foo {
          foo: String
        }
      `;
      const schema = buildSchema(sdl, { assumeValid: true });
      const introspection = introspectionFromSchema(schema);

      expect(introspection.__schema.types[1]).to.deep.include({
        name: 'Foo',
        interfaces: [{ kind: 'OBJECT', name: 'Foo', ofType: null }],
      });

      expect(() => buildClientSchema(introspection)).to.throw(
        'Expected Foo to be a GraphQL Interface type.',
      );
    });

    it('recursive union', () => {
      const sdl = `
        type Query {
          foo: Foo
        }

        union Foo = Foo
      `;
      const schema = buildSchema(sdl, { assumeValid: true });
      const introspection = introspectionFromSchema(schema);

      expect(introspection.__schema.types[1]).to.deep.include({
        name: 'Foo',
        possibleTypes: [{ kind: 'UNION', name: 'Foo', ofType: null }],
      });

      expect(() => buildClientSchema(introspection)).to.throw(
        'Expected Foo to be a GraphQL Object type.',
      );
    });
  });
});
