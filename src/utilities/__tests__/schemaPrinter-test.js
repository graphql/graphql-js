/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

// 80+ char lines are useful in describe/it, so ignore in this file.
/* eslint-disable max-len */

import { describe, it } from 'mocha';
import { expect } from 'chai';
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
  GraphQLID,
} from '../../';


function printForTest(schema) {
  return '\n' + printSchema(schema);
}

function printSingleFieldSchema(fieldConfig) {
  const Root = new GraphQLObjectType({
    name: 'Root',
    fields: { singleField: fieldConfig },
  });
  return printForTest(new GraphQLSchema({ query: Root }));
}

function listOf(type) {
  return new GraphQLList(type);
}

function nonNull(type) {
  return new GraphQLNonNull(type);
}

describe('Type System Printer', () => {
  it('Prints String Field', () => {
    const output = printSingleFieldSchema({
      type: GraphQLString
    });
    expect(output).to.equal(`
schema {
  query: Root
}

type Root {
  singleField: String
}
`
    );
  });

  it('Prints [String] Field', () => {
    const output = printSingleFieldSchema({
      type: listOf(GraphQLString)
    });
    expect(output).to.equal(`
schema {
  query: Root
}

type Root {
  singleField: [String]
}
`
    );
  });

  it('Prints String! Field', () => {
    const output = printSingleFieldSchema({
      type: nonNull(GraphQLString)
    });
    expect(output).to.equal(`
schema {
  query: Root
}

type Root {
  singleField: String!
}
`
    );
  });

  it('Prints [String]! Field', () => {
    const output = printSingleFieldSchema({
      type: nonNull(listOf(GraphQLString))
    });
    expect(output).to.equal(`
schema {
  query: Root
}

type Root {
  singleField: [String]!
}
`
    );
  });

  it('Prints [String!] Field', () => {
    const output = printSingleFieldSchema({
      type: listOf(nonNull(GraphQLString))
    });
    expect(output).to.equal(`
schema {
  query: Root
}

type Root {
  singleField: [String!]
}
`
    );
  });

  it('Prints [String!]! Field', () => {
    const output = printSingleFieldSchema({
      type: nonNull(listOf(nonNull(GraphQLString)))
    });
    expect(output).to.equal(`
schema {
  query: Root
}

type Root {
  singleField: [String!]!
}
`
    );
  });

  it('Print Object Field', () => {
    const FooType = new GraphQLObjectType({
      name: 'Foo',
      fields: { str: { type: GraphQLString } }
    });

    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: { foo: { type: FooType } },
    });

    const Schema = new GraphQLSchema({ query: Root });
    const output = printForTest(Schema);
    expect(output).to.equal(`
schema {
  query: Root
}

type Foo {
  str: String
}

type Root {
  foo: Foo
}
`
    );
  });

  it('Prints String Field With Int Arg', () => {
    const output = printSingleFieldSchema(
      {
        type: GraphQLString,
        args: { argOne: { type: GraphQLInt } },
      }
    );
    expect(output).to.equal(`
schema {
  query: Root
}

type Root {
  singleField(argOne: Int): String
}
`
    );
  });

  it('Prints String Field With Int Arg With Default', () => {
    const output = printSingleFieldSchema(
      {
        type: GraphQLString,
        args: { argOne: { type: GraphQLInt, defaultValue: 2 } },
      }
    );
    expect(output).to.equal(`
schema {
  query: Root
}

type Root {
  singleField(argOne: Int = 2): String
}
`
    );
  });

  it('Prints String Field With Int! Arg', () => {
    const output = printSingleFieldSchema(
      {
        type: GraphQLString,
        args: { argOne: { type: nonNull(GraphQLInt) } },
      }
    );
    expect(output).to.equal(`
schema {
  query: Root
}

type Root {
  singleField(argOne: Int!): String
}
`
    );
  });

  it('Prints String Field With Multiple Args', () => {
    const output = printSingleFieldSchema(
      {
        type: GraphQLString,
        args: {
          argOne: { type: GraphQLInt },
          argTwo: { type: GraphQLString },
        },
      }
    );
    expect(output).to.equal(`
schema {
  query: Root
}

type Root {
  singleField(argOne: Int, argTwo: String): String
}
`
    );
  });

  it('Prints String Field With Multiple Args, First is Default', () => {
    const output = printSingleFieldSchema(
      {
        type: GraphQLString,
        args: {
          argOne: { type: GraphQLInt, defaultValue: 1 },
          argTwo: { type: GraphQLString },
          argThree: { type: GraphQLBoolean },
        },
      }
    );
    expect(output).to.equal(`
schema {
  query: Root
}

type Root {
  singleField(argOne: Int = 1, argTwo: String, argThree: Boolean): String
}
`
    );
  });

  it('Prints String Field With Multiple Args, Second is Default', () => {
    const output = printSingleFieldSchema(
      {
        type: GraphQLString,
        args: {
          argOne: { type: GraphQLInt },
          argTwo: { type: GraphQLString, defaultValue: 'foo' },
          argThree: { type: GraphQLBoolean },
        },
      }
    );
    expect(output).to.equal(`
schema {
  query: Root
}

type Root {
  singleField(argOne: Int, argTwo: String = "foo", argThree: Boolean): String
}
`
    );
  });

  it('Prints String Field With Multiple Args, Last is Default', () => {
    const output = printSingleFieldSchema(
      {
        type: GraphQLString,
        args: {
          argOne: { type: GraphQLInt },
          argTwo: { type: GraphQLString },
          argThree: { type: GraphQLBoolean, defaultValue: false },
        },
      }
    );
    expect(output).to.equal(`
schema {
  query: Root
}

type Root {
  singleField(argOne: Int, argTwo: String, argThree: Boolean = false): String
}
`
    );
  });

  it('Print Interface', () => {
    const FooType = new GraphQLInterfaceType({
      name: 'Foo',
      resolveType: () => null,
      fields: { str: { type: GraphQLString } },
    });

    const BarType = new GraphQLObjectType({
      name: 'Bar',
      fields: { str: { type: GraphQLString } },
      interfaces: [ FooType ],
    });

    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: { bar: { type: BarType } },
    });

    const Schema = new GraphQLSchema({
      query: Root,
      types: [ BarType ]
    });
    const output = printForTest(Schema);
    expect(output).to.equal(`
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
`
    );
  });

  it('Print Multiple Interface', () => {
    const FooType = new GraphQLInterfaceType({
      name: 'Foo',
      resolveType: () => null,
      fields: { str: { type: GraphQLString } },
    });

    const BaazType = new GraphQLInterfaceType({
      name: 'Baaz',
      resolveType: () => null,
      fields: { int: { type: GraphQLInt } },
    });

    const BarType = new GraphQLObjectType({
      name: 'Bar',
      fields: {
        str: { type: GraphQLString },
        int: { type: GraphQLInt },
      },
      interfaces: [ FooType, BaazType ],
    });

    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: { bar: { type: BarType } },
    });

    const Schema = new GraphQLSchema({
      query: Root,
      types: [ BarType ]
    });
    const output = printForTest(Schema);
    expect(output).to.equal(`
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
`
    );
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
      resolveType: () => null,
      types: [ FooType ],
    });

    const MultipleUnion = new GraphQLUnionType({
      name: 'MultipleUnion',
      resolveType: () => null,
      types: [ FooType, BarType ],
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
    expect(output).to.equal(`
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
`
    );
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
    expect(output).to.equal(`
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
    const OddType = new GraphQLScalarType({
      name: 'Odd',
      serialize(value) {
        return value % 2 === 1 ? value : null;
      }
    });

    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        odd: { type: OddType },
      },
    });

    const Schema = new GraphQLSchema({ query: Root });
    const output = printForTest(Schema);
    expect(output).to.equal(`
schema {
  query: Root
}

scalar Odd

type Root {
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
        BLUE: { value: 2 }
      }
    });

    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        rgb: { type: RGBType },
      },
    });

    const Schema = new GraphQLSchema({ query: Root });
    const output = printForTest(Schema);
    expect(output).to.equal(`
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

  it('Print Introspection Schema', () => {
    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        onlyField: { type: GraphQLString }
      },
    });
    const Schema = new GraphQLSchema({ query: Root });
    const output = '\n' + printIntrospectionSchema(Schema);
    const introspectionSchema = `
schema {
  query: Root
}

directive @include(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

directive @skip(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

directive @deprecated(reason: String = "No longer supported") on FIELD_DEFINITION | ENUM_VALUE

type __Directive {
  name: String!
  description: String
  locations: [__DirectiveLocation!]!
  args: [__InputValue!]!
  onOperation: Boolean! @deprecated(reason: "Use \`locations\`.")
  onFragment: Boolean! @deprecated(reason: "Use \`locations\`.")
  onField: Boolean! @deprecated(reason: "Use \`locations\`.")
}

enum __DirectiveLocation {
  QUERY
  MUTATION
  SUBSCRIPTION
  FIELD
  FRAGMENT_DEFINITION
  FRAGMENT_SPREAD
  INLINE_FRAGMENT
  SCHEMA
  SCALAR
  OBJECT
  FIELD_DEFINITION
  ARGUMENT_DEFINITION
  INTERFACE
  UNION
  ENUM
  ENUM_VALUE
  INPUT_OBJECT
  INPUT_FIELD_DEFINITION
}

type __EnumValue {
  name: String!
  description: String
  isDeprecated: Boolean!
  deprecationReason: String
}

type __Field {
  name: String!
  description: String
  args: [__InputValue!]!
  type: __Type!
  isDeprecated: Boolean!
  deprecationReason: String
}

type __InputValue {
  name: String!
  description: String
  type: __Type!
  defaultValue: String
}

type __Schema {
  types: [__Type!]!
  queryType: __Type!
  mutationType: __Type
  subscriptionType: __Type
  directives: [__Directive!]!
}

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

enum __TypeKind {
  SCALAR
  OBJECT
  INTERFACE
  UNION
  ENUM
  INPUT_OBJECT
  LIST
  NON_NULL
}
`;
    expect(output).to.equal(introspectionSchema);
  });


});

function printFineForTest(schema) {
  return '\n' + printSchema(schema, 'hierarchy');
}

function printFineSingleFieldSchema(fieldConfig) {
  const Root = new GraphQLObjectType({
    name: 'Root',
    fields: { singleField: fieldConfig },
  });
  return printFineForTest(new GraphQLSchema({ query: Root }));
}

describe('Type System Printer [printFineSchema]:',() => {
  it('Prints String Field', () => {
    const output = printFineSingleFieldSchema({
      type: GraphQLString
    });
    expect(output).to.equal(`\n\n
type Root {
  singleField: String
}

schema {
  query: Root
}
`
    );
  });

  it('Prints [String] Field', () => {
    const output = printFineSingleFieldSchema({
      type: listOf(GraphQLString)
    });
    expect(output).to.equal(`\n\n
type Root {
  singleField: [String]
}

schema {
  query: Root
}
`
    );
  });

  it('Prints String! Field', () => {
    const output = printFineSingleFieldSchema({
      type: nonNull(GraphQLString)
    });
    expect(output).to.equal(`\n\n
type Root {
  singleField: String!
}

schema {
  query: Root
}
`
    );
  });

  it('Prints [String]! Field', () => {
    const output = printFineSingleFieldSchema({
      type: nonNull(listOf(GraphQLString))
    });
    expect(output).to.equal(`\n\n
type Root {
  singleField: [String]!
}

schema {
  query: Root
}
`
    );
  });

  it('Prints [String!] Field', () => {
    const output = printFineSingleFieldSchema({
      type: listOf(nonNull(GraphQLString))
    });
    expect(output).to.equal(`\n\n
type Root {
  singleField: [String!]
}

schema {
  query: Root
}
`
    );
  });

  it('Prints [String!]! Field', () => {
    const output = printFineSingleFieldSchema({
      type: nonNull(listOf(nonNull(GraphQLString)))
    });
    expect(output).to.equal(`\n\n
type Root {
  singleField: [String!]!
}

schema {
  query: Root
}
`
    );
  });

  it('Print Object Field', () => {
    const FooType = new GraphQLObjectType({
      name: 'Foo',
      fields: { str: { type: GraphQLString } }
    });

    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: { foo: { type: FooType } },
    });

    const Schema = new GraphQLSchema({ query: Root });
    const output = printFineForTest(Schema);
    expect(output).to.equal(`\n\n
type Foo {
  str: String
}

type Root {
  foo: Foo
}

schema {
  query: Root
}
`
    );
  });

  it('Prints String Field With Int Arg', () => {
    const output = printFineSingleFieldSchema(
      {
        type: GraphQLString,
        args: { argOne: { type: GraphQLInt } },
      }
    );
    expect(output).to.equal(`\n\n
type Root {
  singleField(argOne: Int): String
}

schema {
  query: Root
}
`
    );
  });

  it('Prints String Field With Int Arg With Default', () => {
    const output = printFineSingleFieldSchema(
      {
        type: GraphQLString,
        args: { argOne: { type: GraphQLInt, defaultValue: 2 } },
      }
    );
    expect(output).to.equal(`\n\n
type Root {
  singleField(argOne: Int = 2): String
}

schema {
  query: Root
}
`
    );
  });

  it('Prints String Field With Int! Arg', () => {
    const output = printFineSingleFieldSchema(
      {
        type: GraphQLString,
        args: { argOne: { type: nonNull(GraphQLInt) } },
      }
    );
    expect(output).to.equal(`\n\n
type Root {
  singleField(argOne: Int!): String
}

schema {
  query: Root
}
`
    );
  });

  it('Prints String Field With Multiple Args', () => {
    const output = printFineSingleFieldSchema(
      {
        type: GraphQLString,
        args: {
          argOne: { type: GraphQLInt },
          argTwo: { type: GraphQLString },
        },
      }
    );
    expect(output).to.equal(`\n\n
type Root {
  singleField(argOne: Int, argTwo: String): String
}

schema {
  query: Root
}
`
    );
  });

  it('Prints String Field With Multiple Args, First is Default', () => {
    const output = printFineSingleFieldSchema(
      {
        type: GraphQLString,
        args: {
          argOne: { type: GraphQLInt, defaultValue: 1 },
          argTwo: { type: GraphQLString },
          argThree: { type: GraphQLBoolean },
        },
      }
    );
    expect(output).to.equal(`\n\n
type Root {
  singleField(argOne: Int = 1, argTwo: String, argThree: Boolean): String
}

schema {
  query: Root
}
`
    );
  });

  it('Prints String Field With Multiple Args, Second is Default', () => {
    const output = printFineSingleFieldSchema(
      {
        type: GraphQLString,
        args: {
          argOne: { type: GraphQLInt },
          argTwo: { type: GraphQLString, defaultValue: 'foo' },
          argThree: { type: GraphQLBoolean },
        },
      }
    );
    expect(output).to.equal(`\n\n
type Root {
  singleField(argOne: Int, argTwo: String = "foo", argThree: Boolean): String
}

schema {
  query: Root
}
`
    );
  });

  it('Prints String Field With Multiple Args, Last is Default', () => {
    const output = printFineSingleFieldSchema(
      {
        type: GraphQLString,
        args: {
          argOne: { type: GraphQLInt },
          argTwo: { type: GraphQLString },
          argThree: { type: GraphQLBoolean, defaultValue: false },
        },
      }
    );
    expect(output).to.equal(`\n\n
type Root {
  singleField(argOne: Int, argTwo: String, argThree: Boolean = false): String
}

schema {
  query: Root
}
`
    );
  });

  // below is multipul type objects test,
  // results are different from printSchema
  it('Print Interface', () => {
    const FooType = new GraphQLInterfaceType({
      name: 'Foo',
      resolveType: () => null,
      fields: { str: { type: GraphQLString } },
    });

    const BarType = new GraphQLObjectType({
      name: 'Bar',
      fields: { str: { type: GraphQLString } },
      interfaces: [ FooType ],
    });

    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: { bar: { type: BarType } },
    });

    const Schema = new GraphQLSchema({ query: Root });
    const output = printFineForTest(Schema);
    expect(output).to.equal(`\n\n
interface Foo {
  str: String
}

type Bar implements Foo {
  str: String
}

type Root {
  bar: Bar
}

schema {
  query: Root
}
`
    );
  });

  it('Print Multiple Interface', () => {
    const FooType = new GraphQLInterfaceType({
      name: 'Foo',
      resolveType: () => null,
      fields: { str: { type: GraphQLString } },
    });

    const BaazType = new GraphQLInterfaceType({
      name: 'Baaz',
      resolveType: () => null,
      fields: { int: { type: GraphQLInt } },
    });

    const BarType = new GraphQLObjectType({
      name: 'Bar',
      fields: {
        str: { type: GraphQLString },
        int: { type: GraphQLInt },
      },
      interfaces: [ FooType, BaazType ],
    });

    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: { bar: { type: BarType } },
    });

    const Schema = new GraphQLSchema({ query: Root });
    const output = printFineForTest(Schema);
    expect(output).to.equal(`\n\n
interface Baaz {
  int: Int
}

interface Foo {
  str: String
}

type Bar implements Foo, Baaz {
  str: String
  int: Int
}

type Root {
  bar: Bar
}

schema {
  query: Root
}
`
    );
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
      resolveType: () => null,
      types: [ FooType ],
    });

    const MultipleUnion = new GraphQLUnionType({
      name: 'MultipleUnion',
      resolveType: () => null,
      types: [ FooType, BarType ],
    });

    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        single: { type: SingleUnion },
        multiple: { type: MultipleUnion },
      },
    });

    const Schema = new GraphQLSchema({ query: Root });
    const output = printFineForTest(Schema);
    expect(output).to.equal(`\n\n
type Bar {
  str: String
}

type Foo {
  bool: Boolean
}

union MultipleUnion = Foo | Bar

union SingleUnion = Foo

type Root {
  single: SingleUnion
  multiple: MultipleUnion
}

schema {
  query: Root
}
`
    );
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
    const output = printFineForTest(Schema);
    expect(output).to.equal(`\n\n
input InputType {
  int: Int
}

type Root {
  str(argOne: InputType): String
}

schema {
  query: Root
}
`);
  });

  it('Custom Scalar', () => {
    const OddType = new GraphQLScalarType({
      name: 'Odd',
      serialize(value) {
        return value % 2 === 1 ? value : null;
      }
    });

    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        odd: { type: OddType },
      },
    });

    const Schema = new GraphQLSchema({ query: Root });
    const output = printFineForTest(Schema);
    expect(output).to.equal(`\n\n
scalar Odd

type Root {
  odd: Odd
}

schema {
  query: Root
}
`
    );
  });

  it('Enum', () => {
    const RGBType = new GraphQLEnumType({
      name: 'RGB',
      values: {
        RED: { value: 0 },
        GREEN: { value: 1 },
        BLUE: { value: 2 }
      }
    });

    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        rgb: { type: RGBType },
      },
    });

    const Schema = new GraphQLSchema({ query: Root });
    const output = printFineForTest(Schema);
    expect(output).to.equal(`\n\n
enum RGB {
  RED
  GREEN
  BLUE
}

type Root {
  rgb: RGB
}

schema {
  query: Root
}
`);
  });

  it('Circle reference between type', () => {
    const nodeType = new GraphQLInterfaceType({
      name: 'Node',
      resolveType: () => null,
      fields: () => ({
        id: {type: GraphQLString},
        best: {type: dogType},
      }),
    });

    const dogType = new GraphQLObjectType({
      name: 'Dog',
      fields: () => ({
        id: {type: GraphQLString},
        best: {type: dogType},
        look: {type: catType},
      }),
      interfaces: [ nodeType ],
    });

    const mouseType = new GraphQLObjectType({
      name: 'Mouse',
      fields: () => ({
        id: {type: GraphQLString},
        best: {type: dogType},
        find: {type: cowType},
      }),
      interfaces: [ nodeType ],
    });

    const catType = new GraphQLObjectType({
      name: 'Cat',
      fields: () => ({
        id: {type: GraphQLString},
        best: {type: dogType},
        eat: {type: mouseType},
      }),
      interfaces: [ nodeType ],
    });

    const cowType = new GraphQLObjectType({
      name: 'Cow',
      fields: () => ({
        id: {type: GraphQLString},
        best: {type: dogType},
        feed: {type: listOf(nodeType)},
      }),
      interfaces: [ nodeType ],
    });

    const Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        dog: { type: dogType },
        mouse: { type: mouseType },
      },
    });
    const Schema = new GraphQLSchema({ query: Root });
    const output = printFineForTest(Schema);
    expect(output).to.equal(`\n\n
interface Node {
  id: String
  best: Dog
}

type Cow implements Node {
  id: String
  best: Dog
  feed: [Node]
}

type Mouse implements Node {
  id: String
  best: Dog
  find: Cow
}

type Cat implements Node {
  id: String
  best: Dog
  eat: Mouse
}

type Dog implements Node {
  id: String
  best: Dog
  look: Cat
}

type Root {
  dog: Dog
  mouse: Mouse
}

schema {
  query: Root
}
`
    );
  });
  it('relay style types to check right type order', () => {

    const nodeType = new GraphQLInterfaceType({
      name: 'Node',
      resolveType: () => null,
      fields: () => ({
        id: {type: nonNull(GraphQLString)},
      }),
    });

    const newPostInputType = new GraphQLInputObjectType({
      name: 'NewPostInput',
      fields: {
        user: { type: nonNull(GraphQLString) },
        content: { type: nonNull(GraphQLString) },
        clientMutationId: { type: nonNull(GraphQLString) },
      }
    });

    const newPostPayloadType = new GraphQLObjectType({
      name: 'NewPostPayload',
      fields: () => ({
        postEdge: {type: postEdgeType},
        web: {type: webType},
        clientMutationId: { type: nonNull(GraphQLString) },
      }),
    });

    const commentConnectionType = new GraphQLObjectType({
      name: 'CommentConnection',
      fields: () => ({
        pageInfo: {type: nonNull(pageInfoType)},
        edges: {type: listOf(commentEdgeType)},
      }),
    });

    const postConnectionType = new GraphQLObjectType({
      name: 'PostConnection',
      fields: () => ({
        pageInfo: {type: nonNull(pageInfoType)},
        edges: {type: listOf(postEdgeType)},
      }),
    });

    const pageInfoType = new GraphQLObjectType({
      name: 'PageInfo',
      fields: () => ({
        hasNextPage: {type: nonNull(GraphQLBoolean)},
        hasPreviousPage: {type: nonNull(GraphQLBoolean)},
        startCursor: {type: GraphQLString},
        endCursor: {type: GraphQLString},
      }),
    });

    const commentEdgeType = new GraphQLObjectType({
      name: 'CommentEdge',
      fields: () => ({
        node: {type: commentType},
        cursor: {type: nonNull(GraphQLString)},
      }),
    });

    const postEdgeType = new GraphQLObjectType({
      name: 'PostEdge',
      fields: () => ({
        node: {type: postType},
        cursor: {type: nonNull(GraphQLString)},
      }),
    });

    const postSearchType = new GraphQLObjectType({
      name: 'PostSearch',
      fields: () => ({
        postCount: {type: GraphQLInt},
        cursor: {type: postConnectionType},
      }),
    });

    const postType = new GraphQLObjectType({
      name: 'Post',
      fields: () => ({
        id: {type: nonNull(GraphQLString)},
        user: {type: GraphQLString},
        content: {type: GraphQLString},
        comments: {type: commentConnectionType},
      }),
      interfaces: [ nodeType ],
    });

    const commentType = new GraphQLObjectType({
      name: 'Comment',
      fields: () => ({
        id: {type: nonNull(GraphQLString)},
        user: {type: GraphQLString},
        content: {type: GraphQLString},
        replyTo: {type: postType},
      }),
      interfaces: [ nodeType ],
    });

    const webType = new GraphQLObjectType({
      name: 'Web',
      fields: () => ({
        id: {type: nonNull(GraphQLString)},
        postSearch: {
          type: postSearchType,
          args: {
            text: {type: GraphQLString},
          },
        },
        allPosts: {
          type: postConnectionType,
        },
      }),
    });

    const queryType = new GraphQLObjectType({
      name: 'Query',
      fields: {
        web: { type: webType },
        node: {
          type: nodeType,
          args: {
            id: {type: nonNull( GraphQLID)}
          },
          resolve: () => null,
        },
      },
    });
    const mutationType = new GraphQLObjectType({
      name: 'Mutation',
      fields: () => ({
        newPost: {
          type: newPostPayloadType,
          args: {
            input: {
              type: nonNull(newPostInputType),
            },
          },
          resolve: () => null,
        },
      }),
    });
    const Schema = new GraphQLSchema({
      query: queryType ,mutation: mutationType });
    const output = printFineForTest(Schema);
    expect(output).to.equal(`\n\n
interface Node {
  id: String!
}

type Comment implements Node {
  id: String!
  user: String
  content: String
  replyTo: Post
}

type CommentEdge {
  node: Comment
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

type CommentConnection {
  pageInfo: PageInfo!
  edges: [CommentEdge]
}

type Post implements Node {
  id: String!
  user: String
  content: String
  comments: CommentConnection
}

type PostEdge {
  node: Post
  cursor: String!
}

type PostConnection {
  pageInfo: PageInfo!
  edges: [PostEdge]
}

type PostSearch {
  postCount: Int
  cursor: PostConnection
}

type Web {
  id: String!
  postSearch(text: String): PostSearch
  allPosts: PostConnection
}

type Query {
  web: Web
  node(id: ID!): Node
}

input NewPostInput {
  user: String!
  content: String!
  clientMutationId: String!
}

type NewPostPayload {
  postEdge: PostEdge
  web: Web
  clientMutationId: String!
}

type Mutation {
  newPost(input: NewPostInput!): NewPostPayload
}

schema {
  query: Query
  mutation: Mutation
}
`
    );
  });
});
