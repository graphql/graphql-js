import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedent } from '../../__testUtils__/dedent';

import { invariant } from '../../jsutils/invariant';

import {
  assertEnumType,
  GraphQLEnumType,
  GraphQLObjectType,
} from '../../type/definition';
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
} from '../../type/scalars';
import { GraphQLSchema } from '../../type/schema';

import { graphqlSync } from '../../graphql';

import { buildSchema } from '../buildASTSchema';
import { buildClientSchema } from '../buildClientSchema';
import { introspectionFromSchema } from '../introspectionFromSchema';
import { printSchema } from '../printSchema';

/**
 * This function does a full cycle of going from a string with the contents of
 * the SDL, build in-memory GraphQLSchema from it, produce a client-side
 * representation of the schema by using "buildClientSchema" and then
 * returns that schema printed as SDL.
 */
function cycleIntrospection(sdlString: string): string {
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
      """Simple schema"""
      schema {
        query: Simple
      }

      """This is a simple type"""
      type Simple {
        """This is a string field"""
        string: String
      }
    `;

    expect(cycleIntrospection(sdl)).to.equal(sdl);
  });

  it('builds a schema without the query type', () => {
    const sdl = dedent`
      type Query {
        foo: String
      }
    `;

    const schema = buildSchema(sdl);
    const introspection = introspectionFromSchema(schema);

    // @ts-expect-error
    delete introspection.__schema.queryType;

    const clientSchema = buildClientSchema(introspection);
    expect(clientSchema.getQueryType()).to.equal(null);
    expect(printSchema(clientSchema)).to.equal(sdl);
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
    expect(clientSchema.getType('CustomScalar')).to.not.equal(customScalar);
  });

  it('includes standard types only if they are used', () => {
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

  it('builds a schema with an interface hierarchy', () => {
    const sdl = dedent`
      type Dog implements Friendly & Named {
        bestFriend: Friendly
        name: String
      }

      interface Friendly implements Named {
        """The best friend of this friendly thing"""
        bestFriend: Friendly
        name: String
      }

      type Human implements Friendly & Named {
        bestFriend: Friendly
        name: String
      }

      interface Named {
        name: String
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
          value: 2,
        },
        OILS: {
          value: 3,
          deprecationReason: 'Too fatty',
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

    // It's also an Enum type on the client.
    const clientFoodEnum = assertEnumType(clientSchema.getType('Food'));

    // Client types do not get server-only values, so `value` mirrors `name`,
    // rather than using the integers defined in the "server" schema.
    expect(clientFoodEnum.getValues()).to.deep.equal([
      {
        name: 'VEGETABLES',
        description: 'Foods that are vegetables.',
        value: 'VEGETABLES',
        deprecationReason: null,
        extensions: {},
        astNode: undefined,
      },
      {
        name: 'FRUITS',
        description: null,
        value: 'FRUITS',
        deprecationReason: null,
        extensions: {},
        astNode: undefined,
      },
      {
        name: 'OILS',
        description: null,
        value: 'OILS',
        deprecationReason: 'Too fatty',
        extensions: {},
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
      directive @customDirective repeatable on FIELD

      type Query {
        string: String
      }
    `;

    expect(cycleIntrospection(sdl)).to.equal(sdl);
  });

  it('builds a schema without directives', () => {
    const sdl = dedent`
      type Query {
        string: String
      }
    `;

    const schema = buildSchema(sdl);
    const introspection = introspectionFromSchema(schema);

    // @ts-expect-error
    delete introspection.__schema.directives;

    const clientSchema = buildClientSchema(introspection);

    expect(schema.getDirectives()).to.have.lengthOf.above(0);
    expect(clientSchema.getDirectives()).to.deep.equal([]);
    expect(printSchema(clientSchema)).to.equal(sdl);
  });

  it('builds a schema aware of deprecation', () => {
    const sdl = dedent`
      directive @someDirective(
        """This is a shiny new argument"""
        shinyArg: SomeInputObject

        """This was our design mistake :("""
        oldArg: String @deprecated(reason: "Use shinyArg")
      ) on QUERY

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

      input SomeInputObject {
        """Nothing special about it, just deprecated for some unknown reason"""
        oldField: String @deprecated(reason: "Don't use it, use newField instead!")

        """Same field but with a new name"""
        newField: String
      }

      type Query {
        """This is a shiny string field"""
        shinyString: String

        """This is a deprecated string field"""
        deprecatedString: String @deprecated(reason: "Use shinyString")

        """Color of a week"""
        color: Color

        """Some random field"""
        someField(
          """This is a shiny new argument"""
          shinyArg: SomeInputObject

          """This was our design mistake :("""
          oldArg: String @deprecated(reason: "Use shinyArg")
        ): String
      }
    `;

    expect(cycleIntrospection(sdl)).to.equal(sdl);
  });

  it('builds a schema with empty deprecation reasons', () => {
    const sdl = dedent`
      directive @someDirective(someArg: SomeInputObject @deprecated(reason: "")) on QUERY

      type Query {
        someField(someArg: SomeInputObject @deprecated(reason: "")): SomeEnum @deprecated(reason: "")
      }

      input SomeInputObject {
        someInputField: String @deprecated(reason: "")
      }

      enum SomeEnum {
        SOME_VALUE @deprecated(reason: "")
      }
    `;

    expect(cycleIntrospection(sdl)).to.equal(sdl);
  });

  it('builds a schema with specifiedBy url', () => {
    const sdl = dedent`
      scalar Foo @specifiedBy(url: "https://example.com/foo_spec")

      type Query {
        foo: Foo
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

  it('can build invalid schema', () => {
    const schema = buildSchema('type Query', { assumeValid: true });

    const introspection = introspectionFromSchema(schema);
    const clientSchema = buildClientSchema(introspection, {
      assumeValid: true,
    });

    expect(clientSchema.toConfig().assumeValid).to.equal(true);
  });

  describe('throws when given invalid introspection', () => {
    const dummySchema = buildSchema(`
      type Query {
        foo(bar: String): String
      }

      interface SomeInterface {
        foo: String
      }

      union SomeUnion = Query

      enum SomeEnum { FOO }

      input SomeInputObject {
        foo: String
      }

      directive @SomeDirective on QUERY
    `);

    it('throws when introspection is missing __schema property', () => {
      // @ts-expect-error (First parameter expected to be introspection results)
      expect(() => buildClientSchema(null)).to.throw(
        'Invalid or incomplete introspection result. Ensure that you are passing "data" property of introspection response and no "errors" was returned alongside: null.',
      );

      // @ts-expect-error
      expect(() => buildClientSchema({})).to.throw(
        'Invalid or incomplete introspection result. Ensure that you are passing "data" property of introspection response and no "errors" was returned alongside: {}.',
      );
    });

    it('throws when referenced unknown type', () => {
      const introspection = introspectionFromSchema(dummySchema);

      // @ts-expect-error
      introspection.__schema.types = introspection.__schema.types.filter(
        ({ name }) => name !== 'Query',
      );

      expect(() => buildClientSchema(introspection)).to.throw(
        'Invalid or incomplete schema, unknown type: Query. Ensure that a full introspection query is used in order to build a client schema.',
      );
    });

    it('throws when missing definition for one of the standard scalars', () => {
      const schema = buildSchema(`
        type Query {
          foo: Float
        }
      `);
      const introspection = introspectionFromSchema(schema);

      // @ts-expect-error
      introspection.__schema.types = introspection.__schema.types.filter(
        ({ name }) => name !== 'Float',
      );

      expect(() => buildClientSchema(introspection)).to.throw(
        'Invalid or incomplete schema, unknown type: Float. Ensure that a full introspection query is used in order to build a client schema.',
      );
    });

    it('throws when type reference is missing name', () => {
      const introspection = introspectionFromSchema(dummySchema);

      expect(introspection).to.have.nested.property('__schema.queryType.name');

      // @ts-expect-error
      delete introspection.__schema.queryType.name;

      expect(() => buildClientSchema(introspection)).to.throw(
        'Unknown type reference: {}.',
      );
    });

    it('throws when missing kind', () => {
      const introspection = introspectionFromSchema(dummySchema);
      const queryTypeIntrospection = introspection.__schema.types.find(
        ({ name }) => name === 'Query',
      );

      invariant(queryTypeIntrospection?.kind === 'OBJECT');
      // @ts-expect-error
      delete queryTypeIntrospection.kind;

      expect(() => buildClientSchema(introspection)).to.throw(
        /Invalid or incomplete introspection result. Ensure that a full introspection query is used in order to build a client schema: { name: "Query", .* }\./,
      );
    });

    it('throws when missing interfaces', () => {
      const introspection = introspectionFromSchema(dummySchema);
      const queryTypeIntrospection = introspection.__schema.types.find(
        ({ name }) => name === 'Query',
      );

      expect(queryTypeIntrospection).to.have.property('interfaces');

      invariant(queryTypeIntrospection?.kind === 'OBJECT');
      // @ts-expect-error
      delete queryTypeIntrospection.interfaces;

      expect(() => buildClientSchema(introspection)).to.throw(
        /Introspection result missing interfaces: { kind: "OBJECT", name: "Query", .* }\./,
      );
    });

    it('Legacy support for interfaces with null as interfaces field', () => {
      const introspection = introspectionFromSchema(dummySchema);
      const someInterfaceIntrospection = introspection.__schema.types.find(
        ({ name }) => name === 'SomeInterface',
      );

      invariant(someInterfaceIntrospection?.kind === 'INTERFACE');
      // @ts-expect-error
      someInterfaceIntrospection.interfaces = null;

      const clientSchema = buildClientSchema(introspection);
      expect(printSchema(clientSchema)).to.equal(printSchema(dummySchema));
    });

    it('throws when missing fields', () => {
      const introspection = introspectionFromSchema(dummySchema);
      const queryTypeIntrospection = introspection.__schema.types.find(
        ({ name }) => name === 'Query',
      );

      invariant(queryTypeIntrospection?.kind === 'OBJECT');
      // @ts-expect-error
      delete queryTypeIntrospection.fields;

      expect(() => buildClientSchema(introspection)).to.throw(
        /Introspection result missing fields: { kind: "OBJECT", name: "Query", .* }\./,
      );
    });

    it('throws when missing field args', () => {
      const introspection = introspectionFromSchema(dummySchema);
      const queryTypeIntrospection = introspection.__schema.types.find(
        ({ name }) => name === 'Query',
      );

      invariant(queryTypeIntrospection?.kind === 'OBJECT');
      // @ts-expect-error
      delete queryTypeIntrospection.fields[0].args;

      expect(() => buildClientSchema(introspection)).to.throw(
        /Introspection result missing field args: { name: "foo", .* }\./,
      );
    });

    it('throws when output type is used as an arg type', () => {
      const introspection = introspectionFromSchema(dummySchema);
      const queryTypeIntrospection = introspection.__schema.types.find(
        ({ name }) => name === 'Query',
      );

      invariant(queryTypeIntrospection?.kind === 'OBJECT');
      const argType = queryTypeIntrospection.fields[0].args[0].type;
      invariant(argType.kind === 'SCALAR');

      expect(argType).to.have.property('name', 'String');
      // @ts-expect-error
      argType.name = 'SomeUnion';

      expect(() => buildClientSchema(introspection)).to.throw(
        'Introspection must provide input type for arguments, but received: SomeUnion.',
      );
    });

    it('throws when input type is used as a field type', () => {
      const introspection = introspectionFromSchema(dummySchema);
      const queryTypeIntrospection = introspection.__schema.types.find(
        ({ name }) => name === 'Query',
      );

      invariant(queryTypeIntrospection?.kind === 'OBJECT');
      const fieldType = queryTypeIntrospection.fields[0].type;
      invariant(fieldType.kind === 'SCALAR');

      expect(fieldType).to.have.property('name', 'String');
      // @ts-expect-error
      fieldType.name = 'SomeInputObject';

      expect(() => buildClientSchema(introspection)).to.throw(
        'Introspection must provide output type for fields, but received: SomeInputObject.',
      );
    });

    it('throws when missing possibleTypes', () => {
      const introspection = introspectionFromSchema(dummySchema);
      const someUnionIntrospection = introspection.__schema.types.find(
        ({ name }) => name === 'SomeUnion',
      );

      invariant(someUnionIntrospection?.kind === 'UNION');
      // @ts-expect-error
      delete someUnionIntrospection.possibleTypes;

      expect(() => buildClientSchema(introspection)).to.throw(
        /Introspection result missing possibleTypes: { kind: "UNION", name: "SomeUnion",.* }\./,
      );
    });

    it('throws when missing enumValues', () => {
      const introspection = introspectionFromSchema(dummySchema);
      const someEnumIntrospection = introspection.__schema.types.find(
        ({ name }) => name === 'SomeEnum',
      );

      invariant(someEnumIntrospection?.kind === 'ENUM');
      // @ts-expect-error
      delete someEnumIntrospection.enumValues;

      expect(() => buildClientSchema(introspection)).to.throw(
        /Introspection result missing enumValues: { kind: "ENUM", name: "SomeEnum", .* }\./,
      );
    });

    it('throws when missing inputFields', () => {
      const introspection = introspectionFromSchema(dummySchema);
      const someInputObjectIntrospection = introspection.__schema.types.find(
        ({ name }) => name === 'SomeInputObject',
      );

      invariant(someInputObjectIntrospection?.kind === 'INPUT_OBJECT');
      // @ts-expect-error
      delete someInputObjectIntrospection.inputFields;

      expect(() => buildClientSchema(introspection)).to.throw(
        /Introspection result missing inputFields: { kind: "INPUT_OBJECT", name: "SomeInputObject", .* }\./,
      );
    });

    it('throws when missing directive locations', () => {
      const introspection = introspectionFromSchema(dummySchema);

      const someDirectiveIntrospection = introspection.__schema.directives[0];
      expect(someDirectiveIntrospection).to.deep.include({
        name: 'SomeDirective',
        locations: ['QUERY'],
      });

      // @ts-expect-error
      delete someDirectiveIntrospection.locations;

      expect(() => buildClientSchema(introspection)).to.throw(
        /Introspection result missing directive locations: { name: "SomeDirective", .* }\./,
      );
    });

    it('throws when missing directive args', () => {
      const introspection = introspectionFromSchema(dummySchema);

      const someDirectiveIntrospection = introspection.__schema.directives[0];
      expect(someDirectiveIntrospection).to.deep.include({
        name: 'SomeDirective',
        args: [],
      });

      // @ts-expect-error
      delete someDirectiveIntrospection.args;

      expect(() => buildClientSchema(introspection)).to.throw(
        /Introspection result missing directive args: { name: "SomeDirective", .* }\./,
      );
    });
  });

  describe('very deep decorators are not supported', () => {
    it('fails on very deep (> 8 levels) lists', () => {
      const schema = buildSchema(`
        type Query {
          foo: [[[[[[[[[[String]]]]]]]]]]
        }
      `);

      const introspection = introspectionFromSchema(schema);
      expect(() => buildClientSchema(introspection)).to.throw(
        'Decorated type deeper than introspection query.',
      );
    });

    it('fails on a very deep (> 8 levels) non-null', () => {
      const schema = buildSchema(`
        type Query {
          foo: [[[[[String!]!]!]!]!]
        }
      `);

      const introspection = introspectionFromSchema(schema);
      expect(() => buildClientSchema(introspection)).to.throw(
        'Decorated type deeper than introspection query.',
      );
    });

    it('succeeds on deep (<= 8 levels) types', () => {
      // e.g., fully non-null 4D matrix
      const sdl = dedent`
        type Query {
          foo: [[[[String!]!]!]!]!
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

      const fooIntrospection = introspection.__schema.types.find(
        (type) => type.name === 'Foo',
      );
      expect(fooIntrospection).to.deep.include({
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

      const fooIntrospection = introspection.__schema.types.find(
        (type) => type.name === 'Foo',
      );
      expect(fooIntrospection).to.deep.include({
        name: 'Foo',
        possibleTypes: [{ kind: 'UNION', name: 'Foo', ofType: null }],
      });

      expect(() => buildClientSchema(introspection)).to.throw(
        'Expected Foo to be a GraphQL Object type.',
      );
    });
  });
});
