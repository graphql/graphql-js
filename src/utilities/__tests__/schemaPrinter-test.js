/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import dedent from '../../jsutils/dedent';
import { printSchema, printIntrospectionSchema } from '../schemaPrinter';
import {
  GraphQLSchema,
  GraphQLInputObjectType,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLString,
  GraphQLInt,
  GraphQLBoolean,
  GraphQLList,
  GraphQLNonNull,
} from '../../';
import { GraphQLDirective } from '../../type/directives';
import { DirectiveLocation } from '../../language/directiveLocation';

function printForTest(schema) {
  return printSchema(schema);
}

function printSingleFieldSchema(fieldConfig) {
  const Root = new GraphQLObjectType({
    name: 'Root',
    fields: { singleField: fieldConfig },
  });
  return printForTest(new GraphQLSchema({ query: Root }));
}

function listOf(type) {
  return GraphQLList(type);
}

function nonNull(type) {
  return GraphQLNonNull(type);
}

describe('Type System Printer', () => {
  it('Prints String Field', () => {
    const output = printSingleFieldSchema({
      type: GraphQLString,
    });
    expect(output).to.equal(dedent`
      schema {
        query: Root
      }

      type Root {
        singleField: String
      }
    `);
  });

  it('Prints [String] Field', () => {
    const output = printSingleFieldSchema({
      type: listOf(GraphQLString),
    });
    expect(output).to.equal(dedent`
      schema {
        query: Root
      }

      type Root {
        singleField: [String]
      }
    `);
  });

  it('Prints String! Field', () => {
    const output = printSingleFieldSchema({
      type: nonNull(GraphQLString),
    });
    expect(output).to.equal(dedent`
      schema {
        query: Root
      }

      type Root {
        singleField: String!
      }
    `);
  });

  it('Prints [String]! Field', () => {
    const output = printSingleFieldSchema({
      type: nonNull(listOf(GraphQLString)),
    });
    expect(output).to.equal(dedent`
      schema {
        query: Root
      }

      type Root {
        singleField: [String]!
      }
    `);
  });

  it('Prints [String!] Field', () => {
    const output = printSingleFieldSchema({
      type: listOf(nonNull(GraphQLString)),
    });
    expect(output).to.equal(dedent`
      schema {
        query: Root
      }

      type Root {
        singleField: [String!]
      }
    `);
  });

  it('Prints [String!]! Field', () => {
    const output = printSingleFieldSchema({
      type: nonNull(listOf(nonNull(GraphQLString))),
    });
    expect(output).to.equal(dedent`
      schema {
        query: Root
      }

      type Root {
        singleField: [String!]!
      }
    `);
  });

  it('Print Object Field', () => {
    const FooType = new GraphQLObjectType({
      name: 'Foo',
      fields: { str: { type: GraphQLString } },
    });

    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: { foo: { type: FooType } },
    });

    const Schema = new GraphQLSchema({ query: Root });
    const output = printForTest(Schema);
    expect(output).to.equal(dedent`
      schema {
        query: Root
      }

      type Foo {
        str: String
      }

      type Root {
        foo: Foo
      }
    `);
  });

  it('Prints String Field With Int Arg', () => {
    const output = printSingleFieldSchema({
      type: GraphQLString,
      args: { argOne: { type: GraphQLInt } },
    });
    expect(output).to.equal(dedent`
      schema {
        query: Root
      }

      type Root {
        singleField(argOne: Int): String
      }
    `);
  });

  it('Prints String Field With Int Arg With Default', () => {
    const output = printSingleFieldSchema({
      type: GraphQLString,
      args: { argOne: { type: GraphQLInt, defaultValue: 2 } },
    });
    expect(output).to.equal(dedent`
      schema {
        query: Root
      }

      type Root {
        singleField(argOne: Int = 2): String
      }
    `);
  });

  it('Prints String Field With Int Arg With Default Null', () => {
    const output = printSingleFieldSchema({
      type: GraphQLString,
      args: { argOne: { type: GraphQLInt, defaultValue: null } },
    });
    expect(output).to.equal(dedent`
      schema {
        query: Root
      }

      type Root {
        singleField(argOne: Int = null): String
      }
    `);
  });

  it('Prints String Field With Int! Arg', () => {
    const output = printSingleFieldSchema({
      type: GraphQLString,
      args: { argOne: { type: nonNull(GraphQLInt) } },
    });
    expect(output).to.equal(dedent`
      schema {
        query: Root
      }

      type Root {
        singleField(argOne: Int!): String
      }
    `);
  });

  it('Prints String Field With Multiple Args', () => {
    const output = printSingleFieldSchema({
      type: GraphQLString,
      args: {
        argOne: { type: GraphQLInt },
        argTwo: { type: GraphQLString },
      },
    });
    expect(output).to.equal(dedent`
      schema {
        query: Root
      }

      type Root {
        singleField(argOne: Int, argTwo: String): String
      }
    `);
  });

  it('Prints String Field With Multiple Args, First is Default', () => {
    const output = printSingleFieldSchema({
      type: GraphQLString,
      args: {
        argOne: { type: GraphQLInt, defaultValue: 1 },
        argTwo: { type: GraphQLString },
        argThree: { type: GraphQLBoolean },
      },
    });
    expect(output).to.equal(dedent`
      schema {
        query: Root
      }

      type Root {
        singleField(argOne: Int = 1, argTwo: String, argThree: Boolean): String
      }
    `);
  });

  it('Prints String Field With Multiple Args, Second is Default', () => {
    const output = printSingleFieldSchema({
      type: GraphQLString,
      args: {
        argOne: { type: GraphQLInt },
        argTwo: { type: GraphQLString, defaultValue: 'foo' },
        argThree: { type: GraphQLBoolean },
      },
    });
    expect(output).to.equal(dedent`
      schema {
        query: Root
      }

      type Root {
        singleField(argOne: Int, argTwo: String = "foo", argThree: Boolean): String
      }
    `);
  });

  it('Prints String Field With Multiple Args, Last is Default', () => {
    const output = printSingleFieldSchema({
      type: GraphQLString,
      args: {
        argOne: { type: GraphQLInt },
        argTwo: { type: GraphQLString },
        argThree: { type: GraphQLBoolean, defaultValue: false },
      },
    });
    expect(output).to.equal(dedent`
      schema {
        query: Root
      }

      type Root {
        singleField(argOne: Int, argTwo: String, argThree: Boolean = false): String
      }
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

    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: { bar: { type: BarType } },
    });

    const Schema = new GraphQLSchema({
      query: Root,
      types: [BarType],
    });
    const output = printForTest(Schema);
    expect(output).to.equal(dedent`
      schema {
        query: Root
      }

      type Bar implements Foo {
        str: String
      }

      interface Foo {
        str: String
      }

      type Root {
        bar: Bar
      }
    `);
  });

  it('Print Multiple Interface', () => {
    const FooType = new GraphQLInterfaceType({
      name: 'Foo',
      fields: { str: { type: GraphQLString } },
    });

    const BaazType = new GraphQLInterfaceType({
      name: 'Baaz',
      fields: { int: { type: GraphQLInt } },
    });

    const BarType = new GraphQLObjectType({
      name: 'Bar',
      fields: {
        str: { type: GraphQLString },
        int: { type: GraphQLInt },
      },
      interfaces: [FooType, BaazType],
    });

    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: { bar: { type: BarType } },
    });

    const Schema = new GraphQLSchema({
      query: Root,
      types: [BarType],
    });
    const output = printForTest(Schema);
    expect(output).to.equal(dedent`
      schema {
        query: Root
      }

      interface Baaz {
        int: Int
      }

      type Bar implements Foo, Baaz {
        str: String
        int: Int
      }

      interface Foo {
        str: String
      }

      type Root {
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

    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        single: { type: SingleUnion },
        multiple: { type: MultipleUnion },
      },
    });

    const Schema = new GraphQLSchema({ query: Root });
    const output = printForTest(Schema);
    expect(output).to.equal(dedent`
      schema {
        query: Root
      }

      type Bar {
        str: String
      }

      type Foo {
        bool: Boolean
      }

      union MultipleUnion = Foo | Bar

      type Root {
        single: SingleUnion
        multiple: MultipleUnion
      }

      union SingleUnion = Foo
    `);
  });

  it('Print Input Type', () => {
    const InputType = new GraphQLInputObjectType({
      name: 'InputType',
      fields: {
        int: { type: GraphQLInt },
      },
    });

    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        str: {
          type: GraphQLString,
          args: { argOne: { type: InputType } },
        },
      },
    });

    const Schema = new GraphQLSchema({ query: Root });
    const output = printForTest(Schema);
    expect(output).to.equal(dedent`
      schema {
        query: Root
      }

      input InputType {
        int: Int
      }

      type Root {
        str(argOne: InputType): String
      }
    `);
  });

  it('Custom Scalar', () => {
    const EvenType = new GraphQLScalarType({
      name: 'Even',
      ofType: GraphQLInt,
      serialize(value) {
        return value % 2 === 1 ? value : null;
      },
    });

    const OddType = new GraphQLScalarType({
      name: 'Odd',
      // No ofType in this test case.
      serialize(value) {
        return value % 2 === 1 ? value : null;
      },
    });

    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        even: { type: EvenType },
        odd: { type: OddType },
      },
    });

    const Schema = new GraphQLSchema({ query: Root });
    const output = printForTest(Schema);
    expect(output).to.equal(dedent`
      schema {
        query: Root
      }

      scalar Even as Int

      scalar Odd

      type Root {
        even: Even
        odd: Odd
      }
    `);
  });

  it('Enum', () => {
    const RGBType = new GraphQLEnumType({
      name: 'RGB',
      values: {
        RED: { value: 0 },
        GREEN: { value: 1 },
        BLUE: { value: 2 },
      },
    });

    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        rgb: { type: RGBType },
      },
    });

    const Schema = new GraphQLSchema({ query: Root });
    const output = printForTest(Schema);
    expect(output).to.equal(dedent`
      schema {
        query: Root
      }

      enum RGB {
        RED
        GREEN
        BLUE
      }

      type Root {
        rgb: RGB
      }
    `);
  });

  it('Prints custom directives', () => {
    const Query = new GraphQLObjectType({
      name: 'Query',
      fields: {
        field: { type: GraphQLString },
      },
    });

    const CustomDirective = new GraphQLDirective({
      name: 'customDirective',
      locations: [DirectiveLocation.FIELD],
    });

    const Schema = new GraphQLSchema({
      query: Query,
      directives: [CustomDirective],
    });
    const output = printForTest(Schema);
    expect(output).to.equal(dedent`
      directive @customDirective on FIELD

      type Query {
        field: String
      }
    `);
  });

  it('Print Introspection Schema', () => {
    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        onlyField: { type: GraphQLString },
      },
    });
    const Schema = new GraphQLSchema({ query: Root });
    const output = printIntrospectionSchema(Schema);
    const introspectionSchema = dedent`
      schema {
        query: Root
      }

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
        Explains why this element was deprecated, usually also including a suggestion
        for how to access supported similar data. Formatted in
        [Markdown](https://daringfireball.net/projects/markdown/).
        """
        reason: String = "No longer supported"
      ) on FIELD_DEFINITION | ENUM_VALUE

      """
      A Directive provides a way to describe alternate runtime execution and type validation behavior in a GraphQL document.

      In some cases, you need to provide options to alter GraphQL's execution behavior
      in ways field arguments will not suffice, such as conditionally including or
      skipping a field. Directives provide this by describing additional information
      to the executor.
      """
      type __Directive {
        name: String!
        description: String
        locations: [__DirectiveLocation!]!
        args: [__InputValue!]!
        onOperation: Boolean! @deprecated(reason: "Use \`locations\`.")
        onFragment: Boolean! @deprecated(reason: "Use \`locations\`.")
        onField: Boolean! @deprecated(reason: "Use \`locations\`.")
      }

      """
      A Directive can be adjacent to many parts of the GraphQL language, a
      __DirectiveLocation describes one such possible adjacencies.
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

      """
      One possible value for a given Enum. Enum values are unique values, not a
      placeholder for a string or numeric value. However an Enum value is returned in
      a JSON response as a string.
      """
      type __EnumValue {
        name: String!
        description: String
        isDeprecated: Boolean!
        deprecationReason: String
      }

      """
      Object and Interface types are described by a list of Fields, each of which has
      a name, potentially a list of arguments, and a return type.
      """
      type __Field {
        name: String!
        description: String
        args: [__InputValue!]!
        type: __Type!
        isDeprecated: Boolean!
        deprecationReason: String
      }

      """
      Arguments provided to Fields or Directives and the input fields of an
      InputObject are represented as Input Values which describe their type and
      optionally a default value.
      """
      type __InputValue {
        name: String!
        description: String
        type: __Type!

        """
        A GraphQL-formatted string representing the default value for this input value.
        """
        defaultValue: String
      }

      """
      A GraphQL Schema defines the capabilities of a GraphQL server. It exposes all
      available types and directives on the server, as well as the entry points for
      query, mutation, and subscription operations.
      """
      type __Schema {
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
      The fundamental unit of any GraphQL Schema is the type. There are many kinds of
      types in GraphQL as represented by the \`__TypeKind\` enum.

      Depending on the kind of a type, certain fields describe information about that
      type. Scalar types provide a name, description and how they serialize, while
      Enum types provide their possible values. Object and Interface types provide the
      fields they describe. Abstract types, Union and Interface, provide the Object
      types possible at runtime. List and NonNull types compose other types.
      """
      type __Type {
        kind: __TypeKind!
        name: String
        description: String
        fields(includeDeprecated: Boolean = false): [__Field!]
        interfaces: [__Type!]
        possibleTypes: [__Type!]
        enumValues(includeDeprecated: Boolean = false): [__EnumValue!]
        inputFields: [__InputValue!]
        ofType: __Type
      }

      """An enum describing what kind of type a given \`__Type\` is."""
      enum __TypeKind {
        """
        Indicates this type is a scalar. \`ofType\` may represent how this scalar is serialized.
        """
        SCALAR

        """
        Indicates this type is an object. \`fields\` and \`interfaces\` are valid fields.
        """
        OBJECT

        """
        Indicates this type is an interface. \`fields\` and \`possibleTypes\` are valid fields.
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
    `;
    expect(output).to.equal(introspectionSchema);
  });

  it('Print Introspection Schema with comment descriptions', () => {
    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        onlyField: { type: GraphQLString },
      },
    });
    const Schema = new GraphQLSchema({ query: Root });
    const output = printIntrospectionSchema(Schema, {
      commentDescriptions: true,
    });
    const introspectionSchema = dedent`
      schema {
        query: Root
      }

      # Directs the executor to include this field or fragment only when the \`if\` argument is true.
      directive @include(
        # Included when true.
        if: Boolean!
      ) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

      # Directs the executor to skip this field or fragment when the \`if\` argument is true.
      directive @skip(
        # Skipped when true.
        if: Boolean!
      ) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

      # Marks an element of a GraphQL schema as no longer supported.
      directive @deprecated(
        # Explains why this element was deprecated, usually also including a suggestion
        # for how to access supported similar data. Formatted in
        # [Markdown](https://daringfireball.net/projects/markdown/).
        reason: String = "No longer supported"
      ) on FIELD_DEFINITION | ENUM_VALUE

      # A Directive provides a way to describe alternate runtime execution and type validation behavior in a GraphQL document.
      #
      # In some cases, you need to provide options to alter GraphQL's execution behavior
      # in ways field arguments will not suffice, such as conditionally including or
      # skipping a field. Directives provide this by describing additional information
      # to the executor.
      type __Directive {
        name: String!
        description: String
        locations: [__DirectiveLocation!]!
        args: [__InputValue!]!
        onOperation: Boolean! @deprecated(reason: "Use \`locations\`.")
        onFragment: Boolean! @deprecated(reason: "Use \`locations\`.")
        onField: Boolean! @deprecated(reason: "Use \`locations\`.")
      }

      # A Directive can be adjacent to many parts of the GraphQL language, a
      # __DirectiveLocation describes one such possible adjacencies.
      enum __DirectiveLocation {
        # Location adjacent to a query operation.
        QUERY

        # Location adjacent to a mutation operation.
        MUTATION

        # Location adjacent to a subscription operation.
        SUBSCRIPTION

        # Location adjacent to a field.
        FIELD

        # Location adjacent to a fragment definition.
        FRAGMENT_DEFINITION

        # Location adjacent to a fragment spread.
        FRAGMENT_SPREAD

        # Location adjacent to an inline fragment.
        INLINE_FRAGMENT

        # Location adjacent to a schema definition.
        SCHEMA

        # Location adjacent to a scalar definition.
        SCALAR

        # Location adjacent to an object type definition.
        OBJECT

        # Location adjacent to a field definition.
        FIELD_DEFINITION

        # Location adjacent to an argument definition.
        ARGUMENT_DEFINITION

        # Location adjacent to an interface definition.
        INTERFACE

        # Location adjacent to a union definition.
        UNION

        # Location adjacent to an enum definition.
        ENUM

        # Location adjacent to an enum value definition.
        ENUM_VALUE

        # Location adjacent to an input object type definition.
        INPUT_OBJECT

        # Location adjacent to an input object field definition.
        INPUT_FIELD_DEFINITION
      }

      # One possible value for a given Enum. Enum values are unique values, not a
      # placeholder for a string or numeric value. However an Enum value is returned in
      # a JSON response as a string.
      type __EnumValue {
        name: String!
        description: String
        isDeprecated: Boolean!
        deprecationReason: String
      }

      # Object and Interface types are described by a list of Fields, each of which has
      # a name, potentially a list of arguments, and a return type.
      type __Field {
        name: String!
        description: String
        args: [__InputValue!]!
        type: __Type!
        isDeprecated: Boolean!
        deprecationReason: String
      }

      # Arguments provided to Fields or Directives and the input fields of an
      # InputObject are represented as Input Values which describe their type and
      # optionally a default value.
      type __InputValue {
        name: String!
        description: String
        type: __Type!

        # A GraphQL-formatted string representing the default value for this input value.
        defaultValue: String
      }

      # A GraphQL Schema defines the capabilities of a GraphQL server. It exposes all
      # available types and directives on the server, as well as the entry points for
      # query, mutation, and subscription operations.
      type __Schema {
        # A list of all types supported by this server.
        types: [__Type!]!

        # The type that query operations will be rooted at.
        queryType: __Type!

        # If this server supports mutation, the type that mutation operations will be rooted at.
        mutationType: __Type

        # If this server support subscription, the type that subscription operations will be rooted at.
        subscriptionType: __Type

        # A list of all directives supported by this server.
        directives: [__Directive!]!
      }

      # The fundamental unit of any GraphQL Schema is the type. There are many kinds of
      # types in GraphQL as represented by the \`__TypeKind\` enum.
      #
      # Depending on the kind of a type, certain fields describe information about that
      # type. Scalar types provide a name, description and how they serialize, while
      # Enum types provide their possible values. Object and Interface types provide the
      # fields they describe. Abstract types, Union and Interface, provide the Object
      # types possible at runtime. List and NonNull types compose other types.
      type __Type {
        kind: __TypeKind!
        name: String
        description: String
        fields(includeDeprecated: Boolean = false): [__Field!]
        interfaces: [__Type!]
        possibleTypes: [__Type!]
        enumValues(includeDeprecated: Boolean = false): [__EnumValue!]
        inputFields: [__InputValue!]
        ofType: __Type
      }

      # An enum describing what kind of type a given \`__Type\` is.
      enum __TypeKind {
        # Indicates this type is a scalar. \`ofType\` may represent how this scalar is serialized.
        SCALAR

        # Indicates this type is an object. \`fields\` and \`interfaces\` are valid fields.
        OBJECT

        # Indicates this type is an interface. \`fields\` and \`possibleTypes\` are valid fields.
        INTERFACE

        # Indicates this type is a union. \`possibleTypes\` is a valid field.
        UNION

        # Indicates this type is an enum. \`enumValues\` is a valid field.
        ENUM

        # Indicates this type is an input object. \`inputFields\` is a valid field.
        INPUT_OBJECT

        # Indicates this type is a list. \`ofType\` is a valid field.
        LIST

        # Indicates this type is a non-null. \`ofType\` is a valid field.
        NON_NULL
      }
    `;
    expect(output).to.equal(introspectionSchema);
  });
});
