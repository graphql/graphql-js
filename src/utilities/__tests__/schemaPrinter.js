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


function printForTest(schema) {
  return '\n' + printSchema(schema);
}

function printSingleFieldSchema(fieldConfig) {
  var Root = new GraphQLObjectType({
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
    var output = printSingleFieldSchema({
      type: GraphQLString
    });
    expect(output).to.equal(`
type Root {
  singleField: String
}
`
    );
  });

  it('Prints [String] Field', () => {
    var output = printSingleFieldSchema({
      type: listOf(GraphQLString)
    });
    expect(output).to.equal(`
type Root {
  singleField: [String]
}
`
    );
  });

  it('Prints String! Field', () => {
    var output = printSingleFieldSchema({
      type: nonNull(GraphQLString)
    });
    expect(output).to.equal(`
type Root {
  singleField: String!
}
`
    );
  });

  it('Prints [String]! Field', () => {
    var output = printSingleFieldSchema({
      type: nonNull(listOf(GraphQLString))
    });
    expect(output).to.equal(`
type Root {
  singleField: [String]!
}
`
    );
  });

  it('Prints [String!] Field', () => {
    var output = printSingleFieldSchema({
      type: listOf(nonNull(GraphQLString))
    });
    expect(output).to.equal(`
type Root {
  singleField: [String!]
}
`
    );
  });

  it('Prints [String!]! Field', () => {
    var output = printSingleFieldSchema({
      type: nonNull(listOf(nonNull(GraphQLString)))
    });
    expect(output).to.equal(`
type Root {
  singleField: [String!]!
}
`
    );
  });

  it('Print Object Field', () => {
    var FooType = new GraphQLObjectType({
      name: 'Foo',
      fields: { str: { type: GraphQLString } }
    });

    var Root = new GraphQLObjectType({
      name: 'Root',
      fields: { foo: { type: FooType } },
    });

    var Schema = new GraphQLSchema({ query: Root });
    var output = printForTest(Schema);
    expect(output).to.equal(`
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
    var output = printSingleFieldSchema(
      {
        type: GraphQLString,
        args: { argOne: { type: GraphQLInt } },
      }
    );
    expect(output).to.equal(`
type Root {
  singleField(argOne: Int): String
}
`
    );
  });

  it('Prints String Field With Int Arg With Default', () => {
    var output = printSingleFieldSchema(
      {
        type: GraphQLString,
        args: { argOne: { type: GraphQLInt, defaultValue: 2 } },
      }
    );
    expect(output).to.equal(`
type Root {
  singleField(argOne: Int = 2): String
}
`
    );
  });

  it('Prints String Field With Int! Arg', () => {
    var output = printSingleFieldSchema(
      {
        type: GraphQLString,
        args: { argOne: { type: nonNull(GraphQLInt) } },
      }
    );
    expect(output).to.equal(`
type Root {
  singleField(argOne: Int!): String
}
`
    );
  });

  it('Prints String Field With Multiple Args', () => {
    var output = printSingleFieldSchema(
      {
        type: GraphQLString,
        args: {
          argOne: { type: GraphQLInt },
          argTwo: { type: GraphQLString },
        },
      }
    );
    expect(output).to.equal(`
type Root {
  singleField(argOne: Int, argTwo: String): String
}
`
    );
  });

  it('Prints String Field With Multiple Args, First is Default', () => {
    var output = printSingleFieldSchema(
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
type Root {
  singleField(argOne: Int = 1, argTwo: String, argThree: Boolean): String
}
`
    );
  });

  it('Prints String Field With Multiple Args, Second is Default', () => {
    var output = printSingleFieldSchema(
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
type Root {
  singleField(argOne: Int, argTwo: String = "foo", argThree: Boolean): String
}
`
    );
  });

  it('Prints String Field With Multiple Args, Last is Default', () => {
    var output = printSingleFieldSchema(
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
type Root {
  singleField(argOne: Int, argTwo: String, argThree: Boolean = false): String
}
`
    );
  });

  it('Print Interface', () => {
    var FooType = new GraphQLInterfaceType({
      name: 'Foo',
      resolveType: () => null,
      fields: { str: { type: GraphQLString } },
    });

    var BarType = new GraphQLObjectType({
      name: 'Bar',
      fields: { str: { type: GraphQLString } },
      interfaces: [ FooType ],
    });

    var Root = new GraphQLObjectType({
      name: 'Root',
      fields: { bar: { type: BarType } },
    });

    var Schema = new GraphQLSchema({ query: Root });
    var output = printForTest(Schema);
    expect(output).to.equal(`
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
    var FooType = new GraphQLInterfaceType({
      name: 'Foo',
      resolveType: () => null,
      fields: { str: { type: GraphQLString } },
    });

    var BaazType = new GraphQLInterfaceType({
      name: 'Baaz',
      resolveType: () => null,
      fields: { int: { type: GraphQLInt } },
    });

    var BarType = new GraphQLObjectType({
      name: 'Bar',
      fields: {
        str: { type: GraphQLString },
        int: { type: GraphQLInt },
      },
      interfaces: [ FooType, BaazType ],
    });

    var Root = new GraphQLObjectType({
      name: 'Root',
      fields: { bar: { type: BarType } },
    });

    var Schema = new GraphQLSchema({ query: Root });
    var output = printForTest(Schema);
    expect(output).to.equal(`
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
    var FooType = new GraphQLObjectType({
      name: 'Foo',
      fields: {
        bool: { type: GraphQLBoolean },
      },
    });

    var BarType = new GraphQLObjectType({
      name: 'Bar',
      fields: {
        str: { type: GraphQLString },
      },
    });

    var SingleUnion = new GraphQLUnionType({
      name: 'SingleUnion',
      resolveType: () => null,
      types: [ FooType ],
    });

    var MultipleUnion = new GraphQLUnionType({
      name: 'MultipleUnion',
      resolveType: () => null,
      types: [ FooType, BarType ],
    });

    var Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        single: { type: SingleUnion },
        multiple: { type: MultipleUnion },
      },
    });

    var Schema = new GraphQLSchema({ query: Root });
    var output = printForTest(Schema);
    expect(output).to.equal(`
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
    var InputType = new GraphQLInputObjectType({
      name: 'InputType',
      fields: {
        int: { type: GraphQLInt },
      },
    });

    var Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        str: {
          type: GraphQLString,
          args: { argOne: { type: InputType } },
        },
      },
    });

    var Schema = new GraphQLSchema({ query: Root });
    var output = printForTest(Schema);
    expect(output).to.equal(`
input InputType {
  int: Int
}

type Root {
  str(argOne: InputType): String
}
`);
  });

  it('Custom Scalar', () => {
    var OddType = new GraphQLScalarType({
      name: 'Odd',
      serialize(value) {
        return value % 2 === 1 ? value : null;
      }
    });

    var Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        odd: { type: OddType },
      },
    });

    var Schema = new GraphQLSchema({ query: Root });
    var output = printForTest(Schema);
    expect(output).to.equal(`
scalar Odd

type Root {
  odd: Odd
}
`
     );
  });

  it('Enum', () => {
    var RGBType = new GraphQLEnumType({
      name: 'RGB',
      values: {
        RED: { value: 0 },
        GREEN: { value: 1 },
        BLUE: { value: 2 }
      }
    });

    var Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        rgb: { type: RGBType },
      },
    });

    var Schema = new GraphQLSchema({ query: Root });
    var output = printForTest(Schema);
    expect(output).to.equal(`
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
    var Root = new GraphQLObjectType({
      name: 'Root',
      fields: {
        onlyField: { type: GraphQLString }
      },
    });
    var Schema = new GraphQLSchema({ query: Root });
    var output = '\n' + printIntrospectionSchema(Schema);
    var introspectionSchema = `
type __Directive {
  name: String!
  description: String
  args: [__InputValue!]!
  onOperation: Boolean!
  onFragment: Boolean!
  onField: Boolean!
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
