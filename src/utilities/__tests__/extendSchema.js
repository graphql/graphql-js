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
import { extendSchema } from '../extendSchema';
import { execute } from '../../execution';
import { parse } from '../../language';
import { printSchema } from '../schemaPrinter';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLID,
  GraphQLString,
  GraphQLNonNull,
  GraphQLList,
} from '../../type';


// Test schema.
const SomeInterfaceType = new GraphQLInterfaceType({
  name: 'SomeInterface',
  resolveType: () => FooType,
  fields: () => ({
    name: { type: GraphQLString },
    some: { type: SomeInterfaceType },
  })
});

const FooType = new GraphQLObjectType({
  name: 'Foo',
  interfaces: [ SomeInterfaceType ],
  fields: () => ({
    name: { type: GraphQLString },
    some: { type: SomeInterfaceType },
    tree: { type: new GraphQLNonNull(new GraphQLList(FooType)) },
  })
});

/* eslint-disable no-unused-vars */
const BarType = new GraphQLObjectType({
  name: 'Bar',
  interfaces: [ SomeInterfaceType ],
  fields: () => ({
    name: { type: GraphQLString },
    some: { type: SomeInterfaceType },
    foo: { type: FooType },
  })
});
/* eslint-enable no-unused-vars */

const BizType = new GraphQLObjectType({
  name: 'Biz',
  fields: () => ({
    fizz: { type: GraphQLString },
  })
});

const SomeUnionType = new GraphQLUnionType({
  name: 'SomeUnion',
  resolveType: () => FooType,
  types: [ FooType, BizType ],
});

const testSchema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: () => ({
      foo: { type: FooType },
      someUnion: { type: SomeUnionType },
      someInterface: {
        args: { id: { type: new GraphQLNonNull(GraphQLID) } },
        type: SomeInterfaceType
      },
    })
  })
});

describe('extendSchema', () => {

  it('returns the original schema when there are no type definitions', () => {
    const ast = parse('{ field }');
    const extendedSchema = extendSchema(testSchema, ast);
    expect(extendedSchema).to.equal(testSchema);
  });

  it('extends without altering original schema', () => {
    const ast = parse(`
      extend type Query {
        newField: String
      }
    `);
    const originalPrint = printSchema(testSchema);
    const extendedSchema = extendSchema(testSchema, ast);
    expect(extendedSchema).to.not.equal(testSchema);
    expect(printSchema(testSchema)).to.equal(originalPrint);
    expect(printSchema(extendedSchema)).to.contain('newField');
    expect(printSchema(testSchema)).to.not.contain('newField');
  });

  it('cannot be used for execution', async () => {
    const ast = parse(`
      extend type Query {
        newField: String
      }
    `);
    const extendedSchema = extendSchema(testSchema, ast);
    const clientQuery = parse('{ newField }');

    const result = await execute(extendedSchema, clientQuery);
    expect(result.data.newField).to.equal(null);
    expect(result.errors).to.containSubset([ {
      message: 'Client Schema cannot be used for execution.'
    } ]);
  });

  it('extends objects by adding new fields', () => {
    const ast = parse(`
      extend type Foo {
        newField: String
      }
    `);
    const originalPrint = printSchema(testSchema);
    const extendedSchema = extendSchema(testSchema, ast);
    expect(extendedSchema).to.not.equal(testSchema);
    expect(printSchema(testSchema)).to.equal(originalPrint);
    expect(printSchema(extendedSchema)).to.equal(
`type Bar implements SomeInterface {
  name: String
  some: SomeInterface
  foo: Foo
}

type Biz {
  fizz: String
}

type Foo implements SomeInterface {
  name: String
  some: SomeInterface
  tree: [Foo]!
  newField: String
}

type Query {
  foo: Foo
  someUnion: SomeUnion
  someInterface(id: ID!): SomeInterface
}

interface SomeInterface {
  name: String
  some: SomeInterface
}

union SomeUnion = Foo | Biz
`);
  });

  it('extends objects by adding new fields with arguments', () => {
    const ast = parse(`
      extend type Foo {
        newField(arg1: String, arg2: NewInputObj!): String
      }

      input NewInputObj {
        field1: Int
        field2: [Float]
        field3: String!
      }
    `);
    const originalPrint = printSchema(testSchema);
    const extendedSchema = extendSchema(testSchema, ast);
    expect(extendedSchema).to.not.equal(testSchema);
    expect(printSchema(testSchema)).to.equal(originalPrint);
    expect(printSchema(extendedSchema)).to.equal(
`type Bar implements SomeInterface {
  name: String
  some: SomeInterface
  foo: Foo
}

type Biz {
  fizz: String
}

type Foo implements SomeInterface {
  name: String
  some: SomeInterface
  tree: [Foo]!
  newField(arg1: String, arg2: NewInputObj!): String
}

input NewInputObj {
  field1: Int
  field2: [Float]
  field3: String!
}

type Query {
  foo: Foo
  someUnion: SomeUnion
  someInterface(id: ID!): SomeInterface
}

interface SomeInterface {
  name: String
  some: SomeInterface
}

union SomeUnion = Foo | Biz
`);
  });

  it('extends objects by adding implemented interfaces', () => {
    const ast = parse(`
      extend type Biz implements SomeInterface {
        name: String
        some: SomeInterface
      }
    `);
    const originalPrint = printSchema(testSchema);
    const extendedSchema = extendSchema(testSchema, ast);
    expect(extendedSchema).to.not.equal(testSchema);
    expect(printSchema(testSchema)).to.equal(originalPrint);
    expect(printSchema(extendedSchema)).to.equal(
`type Bar implements SomeInterface {
  name: String
  some: SomeInterface
  foo: Foo
}

type Biz implements SomeInterface {
  fizz: String
  name: String
  some: SomeInterface
}

type Foo implements SomeInterface {
  name: String
  some: SomeInterface
  tree: [Foo]!
}

type Query {
  foo: Foo
  someUnion: SomeUnion
  someInterface(id: ID!): SomeInterface
}

interface SomeInterface {
  name: String
  some: SomeInterface
}

union SomeUnion = Foo | Biz
`);
  });

  it('extends objects by including new types', () => {
    const ast = parse(`
      extend type Foo {
        newObject: NewObject
        newInterface: NewInterface
        newUnion: NewUnion
        newScalar: NewScalar
        newEnum: NewEnum
        newTree: [Foo]!
      }

      type NewObject implements NewInterface {
        baz: String
      }

      type NewOtherObject {
        fizz: Int
      }

      interface NewInterface {
        baz: String
      }

      union NewUnion = NewObject | NewOtherObject

      scalar NewScalar

      enum NewEnum {
        OPTION_A
        OPTION_B
      }
    `);
    const originalPrint = printSchema(testSchema);
    const extendedSchema = extendSchema(testSchema, ast);
    expect(extendedSchema).to.not.equal(testSchema);
    expect(printSchema(testSchema)).to.equal(originalPrint);
    expect(printSchema(extendedSchema)).to.equal(
`type Bar implements SomeInterface {
  name: String
  some: SomeInterface
  foo: Foo
}

type Biz {
  fizz: String
}

type Foo implements SomeInterface {
  name: String
  some: SomeInterface
  tree: [Foo]!
  newObject: NewObject
  newInterface: NewInterface
  newUnion: NewUnion
  newScalar: NewScalar
  newEnum: NewEnum
  newTree: [Foo]!
}

enum NewEnum {
  OPTION_A
  OPTION_B
}

interface NewInterface {
  baz: String
}

type NewObject implements NewInterface {
  baz: String
}

type NewOtherObject {
  fizz: Int
}

scalar NewScalar

union NewUnion = NewObject | NewOtherObject

type Query {
  foo: Foo
  someUnion: SomeUnion
  someInterface(id: ID!): SomeInterface
}

interface SomeInterface {
  name: String
  some: SomeInterface
}

union SomeUnion = Foo | Biz
`);
  });

  it('extends objects by adding implemented new interfaces', () => {
    const ast = parse(`
      extend type Foo implements NewInterface {
        baz: String
      }

      interface NewInterface {
        baz: String
      }
    `);
    const originalPrint = printSchema(testSchema);
    const extendedSchema = extendSchema(testSchema, ast);
    expect(extendedSchema).to.not.equal(testSchema);
    expect(printSchema(testSchema)).to.equal(originalPrint);
    expect(printSchema(extendedSchema)).to.equal(
`type Bar implements SomeInterface {
  name: String
  some: SomeInterface
  foo: Foo
}

type Biz {
  fizz: String
}

type Foo implements SomeInterface, NewInterface {
  name: String
  some: SomeInterface
  tree: [Foo]!
  baz: String
}

interface NewInterface {
  baz: String
}

type Query {
  foo: Foo
  someUnion: SomeUnion
  someInterface(id: ID!): SomeInterface
}

interface SomeInterface {
  name: String
  some: SomeInterface
}

union SomeUnion = Foo | Biz
`);
  });

  it('extends objects multiple times', () => {
    const ast = parse(`
      extend type Biz implements NewInterface {
        buzz: String
      }

      extend type Biz implements SomeInterface {
        name: String
        some: SomeInterface
        newFieldA: Int
      }

      extend type Biz {
        newFieldA: Int
        newFieldB: Float
      }

      interface NewInterface {
        buzz: String
      }
    `);
    const originalPrint = printSchema(testSchema);
    const extendedSchema = extendSchema(testSchema, ast);
    expect(extendedSchema).to.not.equal(testSchema);
    expect(printSchema(testSchema)).to.equal(originalPrint);
    expect(printSchema(extendedSchema)).to.equal(
`type Bar implements SomeInterface {
  name: String
  some: SomeInterface
  foo: Foo
}

type Biz implements NewInterface, SomeInterface {
  fizz: String
  buzz: String
  name: String
  some: SomeInterface
  newFieldA: Int
  newFieldB: Float
}

type Foo implements SomeInterface {
  name: String
  some: SomeInterface
  tree: [Foo]!
}

interface NewInterface {
  buzz: String
}

type Query {
  foo: Foo
  someUnion: SomeUnion
  someInterface(id: ID!): SomeInterface
}

interface SomeInterface {
  name: String
  some: SomeInterface
}

union SomeUnion = Foo | Biz
`);
  });

  it('may extend mutations and subscriptions', () => {
    const mutationSchema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: () => ({
          queryField: { type: GraphQLString },
        })
      }),
      mutation: new GraphQLObjectType({
        name: 'Mutation',
        fields: () => ({
          mutationField: { type: GraphQLString },
        })
      }),
      subscription: new GraphQLObjectType({
        name: 'Subscription',
        fields: () => ({
          subscriptionField: { type: GraphQLString },
        })
      }),
    });

    const ast = parse(`
      extend type Query {
        newQueryField: Int
      }

      extend type Mutation {
        newMutationField: Int
      }

      extend type Subscription {
        newSubscriptionField: Int
      }
    `);
    const originalPrint = printSchema(mutationSchema);
    const extendedSchema = extendSchema(mutationSchema, ast);
    expect(extendedSchema).to.not.equal(mutationSchema);
    expect(printSchema(mutationSchema)).to.equal(originalPrint);
    expect(printSchema(extendedSchema)).to.equal(
`type Mutation {
  mutationField: String
  newMutationField: Int
}

type Query {
  queryField: String
  newQueryField: Int
}

type Subscription {
  subscriptionField: String
  newSubscriptionField: Int
}
`);
  });

  it('does not allow replacing an existing type', () => {
    const ast = parse(`
      type Bar {
        baz: String
      }
    `);
    expect(() =>
      extendSchema(testSchema, ast)
    ).to.throw(
      'Type "Bar" already exists in the schema. It cannot also be defined ' +
      'in this type definition.'
    );
  });

  it('does not allow replacing an existing field', () => {
    const ast = parse(`
      extend type Bar {
        foo: Foo
      }
    `);
    expect(() =>
      extendSchema(testSchema, ast)
    ).to.throw(
      'Field "Bar.foo" already exists in the schema. It cannot also be ' +
      'defined in this type extension.'
    );
  });

  it('does not allow implementing an existing interface', () => {
    const ast = parse(`
      extend type Foo implements SomeInterface {
        otherField: String
      }
    `);
    expect(() =>
      extendSchema(testSchema, ast)
    ).to.throw(
      'Type "Foo" already implements "SomeInterface". It cannot also be ' +
      'implemented in this type extension.'
    );
  });

  it('does not allow referencing an unknown type', () => {
    const ast = parse(`
      extend type Bar {
        quix: Quix
      }
    `);
    expect(() =>
      extendSchema(testSchema, ast)
    ).to.throw(
      'Unknown type: "Quix". Ensure that this type exists either in the ' +
      'original schema, or is added in a type definition.'
    );
  });

  it('does not allow extending an unknown type', () => {
    const ast = parse(`
      extend type UnknownType {
        baz: String
      }
    `);
    expect(() =>
      extendSchema(testSchema, ast)
    ).to.throw(
      'Cannot extend type "UnknownType" because it does not exist in the ' +
      'existing schema.'
    );
  });

  describe('does not allow extending a non-object type', () => {

    it('not an interface', () => {
      const ast = parse(`
        extend type SomeInterface {
          baz: String
        }
      `);
      expect(() =>
        extendSchema(testSchema, ast)
      ).to.throw(
        'Cannot extend non-object type "SomeInterface".'
      );
    });

    it('not a scalar', () => {
      const ast = parse(`
        extend type String {
          baz: String
        }
      `);
      expect(() =>
        extendSchema(testSchema, ast)
      ).to.throw(
        'Cannot extend non-object type "String".'
      );
    });

  });
});
