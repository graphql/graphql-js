import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedent, dedentString } from '../../__testUtils__/dedent';

import { DirectiveLocation } from '../../language/directiveLocation';

import type { GraphQLFieldConfig } from '../../type/definition';
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
} from '../../type/definition';
import { GraphQLDirective } from '../../type/directives';
import { GraphQLBoolean, GraphQLInt, GraphQLString } from '../../type/scalars';
import { GraphQLSchema } from '../../type/schema';

import { buildSchema } from '../buildASTSchema';
import { printIntrospectionSchema, printSchema } from '../printSchema';

function expectPrintedSchema(schema: GraphQLSchema) {
  const schemaText = printSchema(schema);
  // keep printSchema and buildSchema in sync
  expect(printSchema(buildSchema(schemaText))).to.equal(schemaText);
  return expect(schemaText);
}

function buildSingleFieldSchema(
  fieldConfig: GraphQLFieldConfig<unknown, unknown>,
) {
  const Query = new GraphQLObjectType({
    name: 'Query',
    fields: { singleField: fieldConfig },
  });
  return new GraphQLSchema({ query: Query });
}

describe('Type System Printer', () => {
  it('Prints String Field', () => {
    const schema = buildSingleFieldSchema({ type: GraphQLString });
    expectPrintedSchema(schema).to.equal(dedent`
      type Query {
        singleField: String
      }
    `);
  });

  it('Prints [String] Field', () => {
    const schema = buildSingleFieldSchema({
      type: new GraphQLList(GraphQLString),
    });

    expectPrintedSchema(schema).to.equal(dedent`
      type Query {
        singleField: [String]
      }
    `);
  });

  it('Prints String! Field', () => {
    const schema = buildSingleFieldSchema({
      type: new GraphQLNonNull(GraphQLString),
    });

    expectPrintedSchema(schema).to.equal(dedent`
      type Query {
        singleField: String!
      }
    `);
  });

  it('Prints [String]! Field', () => {
    const schema = buildSingleFieldSchema({
      type: new GraphQLNonNull(new GraphQLList(GraphQLString)),
    });

    expectPrintedSchema(schema).to.equal(dedent`
      type Query {
        singleField: [String]!
      }
    `);
  });

  it('Prints [String!] Field', () => {
    const schema = buildSingleFieldSchema({
      type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
    });

    expectPrintedSchema(schema).to.equal(dedent`
      type Query {
        singleField: [String!]
      }
    `);
  });

  it('Prints [String!]! Field', () => {
    const schema = buildSingleFieldSchema({
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString)),
      ),
    });

    expectPrintedSchema(schema).to.equal(dedent`
      type Query {
        singleField: [String!]!
      }
    `);
  });

  it('Print Object Field', () => {
    const FooType = new GraphQLObjectType({
      name: 'Foo',
      fields: { str: { type: GraphQLString } },
    });
    const schema = new GraphQLSchema({ types: [FooType] });

    expectPrintedSchema(schema).to.equal(dedent`
      type Foo {
        str: String
      }
    `);
  });

  it('Prints String Field With Int Arg', () => {
    const schema = buildSingleFieldSchema({
      type: GraphQLString,
      args: { argOne: { type: GraphQLInt } },
    });

    expectPrintedSchema(schema).to.equal(dedent`
      type Query {
        singleField(argOne: Int): String
      }
    `);
  });

  it('Prints String Field With Int Arg With Default', () => {
    const schema = buildSingleFieldSchema({
      type: GraphQLString,
      args: { argOne: { type: GraphQLInt, defaultValue: 2 } },
    });

    expectPrintedSchema(schema).to.equal(dedent`
      type Query {
        singleField(argOne: Int = 2): String
      }
    `);
  });

  it('Prints String Field With String Arg With Default', () => {
    const schema = buildSingleFieldSchema({
      type: GraphQLString,
      args: { argOne: { type: GraphQLString, defaultValue: 'tes\t de\fault' } },
    });

    expectPrintedSchema(schema).to.equal(
      dedentString(String.raw`
        type Query {
          singleField(argOne: String = "tes\t de\fault"): String
        }
      `),
    );
  });

  it('Prints String Field With Int Arg With Default Null', () => {
    const schema = buildSingleFieldSchema({
      type: GraphQLString,
      args: { argOne: { type: GraphQLInt, defaultValue: null } },
    });

    expectPrintedSchema(schema).to.equal(dedent`
      type Query {
        singleField(argOne: Int = null): String
      }
    `);
  });

  it('Prints String Field With Int! Arg', () => {
    const schema = buildSingleFieldSchema({
      type: GraphQLString,
      args: { argOne: { type: new GraphQLNonNull(GraphQLInt) } },
    });

    expectPrintedSchema(schema).to.equal(dedent`
      type Query {
        singleField(argOne: Int!): String
      }
    `);
  });

  it('Prints String Field With Multiple Args', () => {
    const schema = buildSingleFieldSchema({
      type: GraphQLString,
      args: {
        argOne: { type: GraphQLInt },
        argTwo: { type: GraphQLString },
      },
    });

    expectPrintedSchema(schema).to.equal(dedent`
      type Query {
        singleField(argOne: Int, argTwo: String): String
      }
    `);
  });

  it('Prints String Field With Multiple Args, First is Default', () => {
    const schema = buildSingleFieldSchema({
      type: GraphQLString,
      args: {
        argOne: { type: GraphQLInt, defaultValue: 1 },
        argTwo: { type: GraphQLString },
        argThree: { type: GraphQLBoolean },
      },
    });

    expectPrintedSchema(schema).to.equal(dedent`
      type Query {
        singleField(argOne: Int = 1, argTwo: String, argThree: Boolean): String
      }
    `);
  });

  it('Prints String Field With Multiple Args, Second is Default', () => {
    const schema = buildSingleFieldSchema({
      type: GraphQLString,
      args: {
        argOne: { type: GraphQLInt },
        argTwo: { type: GraphQLString, defaultValue: 'foo' },
        argThree: { type: GraphQLBoolean },
      },
    });

    expectPrintedSchema(schema).to.equal(dedent`
      type Query {
        singleField(argOne: Int, argTwo: String = "foo", argThree: Boolean): String
      }
    `);
  });

  it('Prints String Field With Multiple Args, Last is Default', () => {
    const schema = buildSingleFieldSchema({
      type: GraphQLString,
      args: {
        argOne: { type: GraphQLInt },
        argTwo: { type: GraphQLString },
        argThree: { type: GraphQLBoolean, defaultValue: false },
      },
    });

    expectPrintedSchema(schema).to.equal(dedent`
      type Query {
        singleField(argOne: Int, argTwo: String, argThree: Boolean = false): String
      }
    `);
  });

  it('Prints schema with description', () => {
    const schema = new GraphQLSchema({
      description: 'Schema description.',
      query: new GraphQLObjectType({ name: 'Query', fields: {} }),
    });

    expectPrintedSchema(schema).to.equal(dedent`
      """Schema description."""
      schema {
        query: Query
      }

      type Query
    `);
  });

  it('Omits schema of common names', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({ name: 'Query', fields: {} }),
      mutation: new GraphQLObjectType({ name: 'Mutation', fields: {} }),
      subscription: new GraphQLObjectType({ name: 'Subscription', fields: {} }),
    });

    expectPrintedSchema(schema).to.equal(dedent`
      type Query

      type Mutation

      type Subscription
    `);
  });

  it('Prints custom query root types', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({ name: 'CustomType', fields: {} }),
    });

    expectPrintedSchema(schema).to.equal(dedent`
      schema {
        query: CustomType
      }

      type CustomType
    `);
  });

  it('Prints custom mutation root types', () => {
    const schema = new GraphQLSchema({
      mutation: new GraphQLObjectType({ name: 'CustomType', fields: {} }),
    });

    expectPrintedSchema(schema).to.equal(dedent`
      schema {
        mutation: CustomType
      }

      type CustomType
    `);
  });

  it('Prints custom subscription root types', () => {
    const schema = new GraphQLSchema({
      subscription: new GraphQLObjectType({ name: 'CustomType', fields: {} }),
    });

    expectPrintedSchema(schema).to.equal(dedent`
      schema {
        subscription: CustomType
      }

      type CustomType
    `);
  });

  it('Print Interface', () => {
    const FooType = new GraphQLInterfaceType({
      name: 'Foo',
      fields: { str: { type: GraphQLString } },
    });

    const BarType = new GraphQLObjectType({
      name: 'Bar',
      fields: { str: { type: GraphQLString } },
      interfaces: [FooType],
    });

    const schema = new GraphQLSchema({ types: [BarType] });
    expectPrintedSchema(schema).to.equal(dedent`
      type Bar implements Foo {
        str: String
      }

      interface Foo {
        str: String
      }
    `);
  });

  it('Print Multiple Interface', () => {
    const FooType = new GraphQLInterfaceType({
      name: 'Foo',
      fields: { str: { type: GraphQLString } },
    });

    const BazType = new GraphQLInterfaceType({
      name: 'Baz',
      fields: { int: { type: GraphQLInt } },
    });

    const BarType = new GraphQLObjectType({
      name: 'Bar',
      fields: {
        str: { type: GraphQLString },
        int: { type: GraphQLInt },
      },
      interfaces: [FooType, BazType],
    });

    const schema = new GraphQLSchema({ types: [BarType] });
    expectPrintedSchema(schema).to.equal(dedent`
      type Bar implements Foo & Baz {
        str: String
        int: Int
      }

      interface Foo {
        str: String
      }

      interface Baz {
        int: Int
      }
    `);
  });

  it('Print Hierarchical Interface', () => {
    const FooType = new GraphQLInterfaceType({
      name: 'Foo',
      fields: { str: { type: GraphQLString } },
    });

    const BazType = new GraphQLInterfaceType({
      name: 'Baz',
      interfaces: [FooType],
      fields: {
        int: { type: GraphQLInt },
        str: { type: GraphQLString },
      },
    });

    const BarType = new GraphQLObjectType({
      name: 'Bar',
      fields: {
        str: { type: GraphQLString },
        int: { type: GraphQLInt },
      },
      interfaces: [FooType, BazType],
    });

    const Query = new GraphQLObjectType({
      name: 'Query',
      fields: { bar: { type: BarType } },
    });

    const schema = new GraphQLSchema({ query: Query, types: [BarType] });
    expectPrintedSchema(schema).to.equal(dedent`
      type Bar implements Foo & Baz {
        str: String
        int: Int
      }

      interface Foo {
        str: String
      }

      interface Baz implements Foo {
        int: Int
        str: String
      }

      type Query {
        bar: Bar
      }
    `);
  });

  it('Print Unions', () => {
    const FooType = new GraphQLObjectType({
      name: 'Foo',
      fields: {
        bool: { type: GraphQLBoolean },
      },
    });

    const BarType = new GraphQLObjectType({
      name: 'Bar',
      fields: {
        str: { type: GraphQLString },
      },
    });

    const SingleUnion = new GraphQLUnionType({
      name: 'SingleUnion',
      types: [FooType],
    });

    const MultipleUnion = new GraphQLUnionType({
      name: 'MultipleUnion',
      types: [FooType, BarType],
    });

    const schema = new GraphQLSchema({ types: [SingleUnion, MultipleUnion] });
    expectPrintedSchema(schema).to.equal(dedent`
      union SingleUnion = Foo

      type Foo {
        bool: Boolean
      }

      union MultipleUnion = Foo | Bar

      type Bar {
        str: String
      }
    `);
  });

  it('Print Input Type', () => {
    const InputType = new GraphQLInputObjectType({
      name: 'InputType',
      fields: {
        int: { type: GraphQLInt },
      },
    });

    const schema = new GraphQLSchema({ types: [InputType] });
    expectPrintedSchema(schema).to.equal(dedent`
      input InputType {
        int: Int
      }
    `);
  });

  it('Custom Scalar', () => {
    const OddType = new GraphQLScalarType({ name: 'Odd' });

    const schema = new GraphQLSchema({ types: [OddType] });
    expectPrintedSchema(schema).to.equal(dedent`
      scalar Odd
    `);
  });

  it('Custom Scalar with specifiedByURL', () => {
    const FooType = new GraphQLScalarType({
      name: 'Foo',
      specifiedByURL: 'https://example.com/foo_spec',
    });

    const schema = new GraphQLSchema({ types: [FooType] });
    expectPrintedSchema(schema).to.equal(dedent`
      scalar Foo @specifiedBy(url: "https://example.com/foo_spec")
    `);
  });

  it('Enum', () => {
    const RGBType = new GraphQLEnumType({
      name: 'RGB',
      values: {
        RED: {},
        GREEN: {},
        BLUE: {},
      },
    });

    const schema = new GraphQLSchema({ types: [RGBType] });
    expectPrintedSchema(schema).to.equal(dedent`
      enum RGB {
        RED
        GREEN
        BLUE
      }
    `);
  });

  it('Prints empty types', () => {
    const schema = new GraphQLSchema({
      types: [
        new GraphQLEnumType({ name: 'SomeEnum', values: {} }),
        new GraphQLInputObjectType({ name: 'SomeInputObject', fields: {} }),
        new GraphQLInterfaceType({ name: 'SomeInterface', fields: {} }),
        new GraphQLObjectType({ name: 'SomeObject', fields: {} }),
        new GraphQLUnionType({ name: 'SomeUnion', types: [] }),
      ],
    });

    expectPrintedSchema(schema).to.equal(dedent`
      enum SomeEnum

      input SomeInputObject

      interface SomeInterface

      type SomeObject

      union SomeUnion
    `);
  });

  it('Prints custom directives', () => {
    const SimpleDirective = new GraphQLDirective({
      name: 'simpleDirective',
      locations: [DirectiveLocation.FIELD],
    });
    const ComplexDirective = new GraphQLDirective({
      name: 'complexDirective',
      description: 'Complex Directive',
      args: {
        stringArg: { type: GraphQLString },
        intArg: { type: GraphQLInt, defaultValue: -1 },
      },
      isRepeatable: true,
      locations: [DirectiveLocation.FIELD, DirectiveLocation.QUERY],
    });

    const schema = new GraphQLSchema({
      directives: [SimpleDirective, ComplexDirective],
    });
    expectPrintedSchema(schema).to.equal(dedent`
      directive @simpleDirective on FIELD

      """Complex Directive"""
      directive @complexDirective(stringArg: String, intArg: Int = -1) repeatable on FIELD | QUERY
    `);
  });

  it('Prints an empty description', () => {
    const schema = buildSingleFieldSchema({
      type: GraphQLString,
      description: '',
    });

    expectPrintedSchema(schema).to.equal(dedent`
      type Query {
        """"""
        singleField: String
      }
    `);
  });

  it('Prints an description with only whitespace', () => {
    const schema = buildSingleFieldSchema({
      type: GraphQLString,
      description: ' ',
    });

    expectPrintedSchema(schema).to.equal(dedent`
      type Query {
        " "
        singleField: String
      }
    `);
  });

  it('One-line prints a short description', () => {
    const schema = buildSingleFieldSchema({
      type: GraphQLString,
      description: 'This field is awesome',
    });

    expectPrintedSchema(schema).to.equal(dedent`
      type Query {
        """This field is awesome"""
        singleField: String
      }
    `);
  });

  it('Print Introspection Schema', () => {
    const schema = new GraphQLSchema({});
    const output = printIntrospectionSchema(schema);

    expect(output).to.equal(dedent`
      """
      Directs the executor to include this field or fragment only when the \`if\` argument is true.
      """
      directive @include(
        """Included when true."""
        if: Boolean!
      ) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

      """
      Directs the executor to skip this field or fragment when the \`if\` argument is true.
      """
      directive @skip(
        """Skipped when true."""
        if: Boolean!
      ) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

      """Marks an element of a GraphQL schema as no longer supported."""
      directive @deprecated(
        """
        Explains why this element was deprecated, usually also including a suggestion for how to access supported similar data. Formatted using the Markdown syntax, as specified by [CommonMark](https://commonmark.org/).
        """
        reason: String = "No longer supported"
      ) on FIELD_DEFINITION | ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION | ENUM_VALUE

      """Exposes a URL that specifies the behavior of this scalar."""
      directive @specifiedBy(
        """The URL that specifies the behavior of this scalar."""
        url: String!
      ) on SCALAR

      """
      A GraphQL Schema defines the capabilities of a GraphQL server. It exposes all available types and directives on the server, as well as the entry points for query, mutation, and subscription operations.
      """
      type __Schema {
        description: String

        """A list of all types supported by this server."""
        types: [__Type!]!

        """The type that query operations will be rooted at."""
        queryType: __Type!

        """
        If this server supports mutation, the type that mutation operations will be rooted at.
        """
        mutationType: __Type

        """
        If this server support subscription, the type that subscription operations will be rooted at.
        """
        subscriptionType: __Type

        """A list of all directives supported by this server."""
        directives: [__Directive!]!
      }

      """
      The fundamental unit of any GraphQL Schema is the type. There are many kinds of types in GraphQL as represented by the \`__TypeKind\` enum.

      Depending on the kind of a type, certain fields describe information about that type. Scalar types provide no information beyond a name, description and optional \`specifiedByURL\`, while Enum types provide their values. Object and Interface types provide the fields they describe. Abstract types, Union and Interface, provide the Object types possible at runtime. List and NonNull types compose other types.
      """
      type __Type {
        kind: __TypeKind!
        name: String
        description: String
        specifiedByURL: String
        fields(includeDeprecated: Boolean = false): [__Field!]
        interfaces: [__Type!]
        possibleTypes: [__Type!]
        enumValues(includeDeprecated: Boolean = false): [__EnumValue!]
        inputFields(includeDeprecated: Boolean = false): [__InputValue!]
        ofType: __Type
      }

      """An enum describing what kind of type a given \`__Type\` is."""
      enum __TypeKind {
        """Indicates this type is a scalar."""
        SCALAR

        """
        Indicates this type is an object. \`fields\` and \`interfaces\` are valid fields.
        """
        OBJECT

        """
        Indicates this type is an interface. \`fields\`, \`interfaces\`, and \`possibleTypes\` are valid fields.
        """
        INTERFACE

        """Indicates this type is a union. \`possibleTypes\` is a valid field."""
        UNION

        """Indicates this type is an enum. \`enumValues\` is a valid field."""
        ENUM

        """
        Indicates this type is an input object. \`inputFields\` is a valid field.
        """
        INPUT_OBJECT

        """Indicates this type is a list. \`ofType\` is a valid field."""
        LIST

        """Indicates this type is a non-null. \`ofType\` is a valid field."""
        NON_NULL
      }

      """
      Object and Interface types are described by a list of Fields, each of which has a name, potentially a list of arguments, and a return type.
      """
      type __Field {
        name: String!
        description: String
        args(includeDeprecated: Boolean = false): [__InputValue!]!
        type: __Type!
        isDeprecated: Boolean!
        deprecationReason: String
      }

      """
      Arguments provided to Fields or Directives and the input fields of an InputObject are represented as Input Values which describe their type and optionally a default value.
      """
      type __InputValue {
        name: String!
        description: String
        type: __Type!

        """
        A GraphQL-formatted string representing the default value for this input value.
        """
        defaultValue: String
        isDeprecated: Boolean!
        deprecationReason: String
      }

      """
      One possible value for a given Enum. Enum values are unique values, not a placeholder for a string or numeric value. However an Enum value is returned in a JSON response as a string.
      """
      type __EnumValue {
        name: String!
        description: String
        isDeprecated: Boolean!
        deprecationReason: String
      }

      """
      A Directive provides a way to describe alternate runtime execution and type validation behavior in a GraphQL document.

      In some cases, you need to provide options to alter GraphQL's execution behavior in ways field arguments will not suffice, such as conditionally including or skipping a field. Directives provide this by describing additional information to the executor.
      """
      type __Directive {
        name: String!
        description: String
        isRepeatable: Boolean!
        locations: [__DirectiveLocation!]!
        args(includeDeprecated: Boolean = false): [__InputValue!]!
      }

      """
      A Directive can be adjacent to many parts of the GraphQL language, a __DirectiveLocation describes one such possible adjacencies.
      """
      enum __DirectiveLocation {
        """Location adjacent to a query operation."""
        QUERY

        """Location adjacent to a mutation operation."""
        MUTATION

        """Location adjacent to a subscription operation."""
        SUBSCRIPTION

        """Location adjacent to a field."""
        FIELD

        """Location adjacent to a fragment definition."""
        FRAGMENT_DEFINITION

        """Location adjacent to a fragment spread."""
        FRAGMENT_SPREAD

        """Location adjacent to an inline fragment."""
        INLINE_FRAGMENT

        """Location adjacent to a variable definition."""
        VARIABLE_DEFINITION

        """Location adjacent to a schema definition."""
        SCHEMA

        """Location adjacent to a scalar definition."""
        SCALAR

        """Location adjacent to an object type definition."""
        OBJECT

        """Location adjacent to a field definition."""
        FIELD_DEFINITION

        """Location adjacent to an argument definition."""
        ARGUMENT_DEFINITION

        """Location adjacent to an interface definition."""
        INTERFACE

        """Location adjacent to a union definition."""
        UNION

        """Location adjacent to an enum definition."""
        ENUM

        """Location adjacent to an enum value definition."""
        ENUM_VALUE

        """Location adjacent to an input object type definition."""
        INPUT_OBJECT

        """Location adjacent to an input object field definition."""
        INPUT_FIELD_DEFINITION
      }
    `);
  });
});
