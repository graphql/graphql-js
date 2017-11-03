/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import dedent from '../../jsutils/dedent';
import { buildSchema } from '../buildASTSchema';
import { extendSchema } from '../extendSchema';
import { execute } from '../../execution';
import { parse, print } from '../../language';
import { printSchema } from '../schemaPrinter';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLID,
  GraphQLString,
  GraphQLEnumType,
  GraphQLNonNull,
  GraphQLList,
  GraphQLScalarType,
} from '../../type';

// Test schema.
const SomeInterfaceType = new GraphQLInterfaceType({
  name: 'SomeInterface',
  resolveType: () => FooType,
  fields: () => ({
    name: { type: GraphQLString },
    some: { type: SomeInterfaceType },
  }),
});

const FooType = new GraphQLObjectType({
  name: 'Foo',
  interfaces: [SomeInterfaceType],
  fields: () => ({
    name: { type: GraphQLString },
    some: { type: SomeInterfaceType },
    tree: { type: new GraphQLNonNull(new GraphQLList(FooType)) },
  }),
});

const BarType = new GraphQLObjectType({
  name: 'Bar',
  interfaces: [SomeInterfaceType],
  fields: () => ({
    name: { type: GraphQLString },
    some: { type: SomeInterfaceType },
    foo: { type: FooType },
  }),
});

const BizType = new GraphQLObjectType({
  name: 'Biz',
  fields: () => ({
    fizz: { type: GraphQLString },
  }),
});

const SomeUnionType = new GraphQLUnionType({
  name: 'SomeUnion',
  resolveType: () => FooType,
  types: [FooType, BizType],
});

const SomeEnumType = new GraphQLEnumType({
  name: 'SomeEnum',
  values: {
    ONE: { value: 1 },
    TWO: { value: 2 },
  },
});

const testSchema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: () => ({
      foo: { type: FooType },
      someUnion: { type: SomeUnionType },
      someEnum: { type: SomeEnumType },
      someInterface: {
        args: { id: { type: new GraphQLNonNull(GraphQLID) } },
        type: SomeInterfaceType,
      },
    }),
  }),
  types: [FooType, BarType],
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

  it('can be used for limited execution', async () => {
    const ast = parse(`
      extend type Query {
        newField: String
      }
    `);
    const extendedSchema = extendSchema(testSchema, ast);
    const clientQuery = parse('{ newField }');

    const result = await execute(extendedSchema, clientQuery, {
      newField: 123,
    });
    expect(result.data).to.deep.equal({ newField: '123' });
  });

  it('can describe the extended fields', async () => {
    const ast = parse(`
      extend type Query {
        # New field description.
        newField: String
      }
    `);
    const extendedSchema = extendSchema(testSchema, ast);

    expect(
      extendedSchema.getType('Query').getFields().newField.description,
    ).to.equal('New field description.');
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
    expect(printSchema(extendedSchema)).to.equal(dedent`
      type Bar implements SomeInterface {
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
        someEnum: SomeEnum
        someInterface(id: ID!): SomeInterface
      }

      enum SomeEnum {
        ONE
        TWO
      }

      interface SomeInterface {
        name: String
        some: SomeInterface
      }

      union SomeUnion = Foo | Biz
    `);
  });

  it('correctly assign AST nodes to new and extended types', () => {
    const schemaFromIDL = buildSchema(`
      type Query {
        dummyField: String
      }
    `);
    const extensionAst = parse(`
      extend type Query {
        newField(testArg: TestInput): TestEnum
      }

      enum TestEnum {
        TEST_VALUE
      }

      input TestInput {
        testInputField: TestEnum
      }
    `);
    const extendedSchema = extendSchema(schemaFromIDL, extensionAst);
    const secondExtensionAst = parse(`
      extend type Query {
        oneMoreNewField: TestUnion
      }

      union TestUnion = TestType

      interface TestInterface {
        interfaceField: String
      }

      type TestType implements TestInterface {
        interfaceField: String
      }

      directive @test(arg: Int) on FIELD
    `);
    const extendedTwiceSchema = extendSchema(
      extendedSchema,
      secondExtensionAst,
    );

    const query = extendedTwiceSchema.getType('Query');
    const testInput = extendedTwiceSchema.getType('TestInput');
    const testEnum = extendedTwiceSchema.getType('TestEnum');
    const testUnion = extendedTwiceSchema.getType('TestUnion');
    const testInterface = extendedTwiceSchema.getType('TestInterface');
    const testType = extendedTwiceSchema.getType('TestType');
    const testDirective = extendedTwiceSchema.getDirective('test');

    expect(query.extensionASTNodes).to.have.lengthOf(2);
    expect(testType.extensionASTNodes).to.have.lengthOf(0);

    const restoredExtensionAST = parse(
      print(query.extensionASTNodes[0]) +
        '\n' +
        print(query.extensionASTNodes[1]) +
        '\n' +
        print(testInput.astNode) +
        '\n' +
        print(testEnum.astNode) +
        '\n' +
        print(testUnion.astNode) +
        '\n' +
        print(testInterface.astNode) +
        '\n' +
        print(testType.astNode) +
        '\n' +
        print(testDirective.astNode),
    );
    expect(
      printSchema(extendSchema(schemaFromIDL, restoredExtensionAST)),
    ).to.be.equal(printSchema(extendedTwiceSchema));

    const newField = query.getFields().newField;
    expect(print(newField.astNode)).to.equal(
      'newField(testArg: TestInput): TestEnum',
    );
    expect(print(newField.args[0].astNode)).to.equal('testArg: TestInput');
    expect(print(query.getFields().oneMoreNewField.astNode)).to.equal(
      'oneMoreNewField: TestUnion',
    );
    expect(print(testInput.getFields().testInputField.astNode)).to.equal(
      'testInputField: TestEnum',
    );
    expect(print(testEnum.getValue('TEST_VALUE').astNode)).to.equal(
      'TEST_VALUE',
    );
    expect(print(testInterface.getFields().interfaceField.astNode)).to.equal(
      'interfaceField: String',
    );
    expect(print(testType.getFields().interfaceField.astNode)).to.equal(
      'interfaceField: String',
    );
    expect(print(testDirective.args[0].astNode)).to.equal('arg: Int');
  });

  it('builds types with deprecated fields/values', () => {
    const ast = parse(`
      type TypeWithDeprecatedField {
        newDeprecatedField: String @deprecated(reason: "not used anymore")
      }

      enum EnumWithDeprecatedValue {
        DEPRECATED @deprecated(reason: "do not use")
      }
    `);
    const extendedSchema = extendSchema(testSchema, ast);
    const deprecatedFieldDef = extendedSchema
      .getType('TypeWithDeprecatedField')
      .getFields().newDeprecatedField;
    expect(deprecatedFieldDef.isDeprecated).to.equal(true);
    expect(deprecatedFieldDef.deprecationReason).to.equal('not used anymore');

    const deprecatedEnumDef = extendedSchema
      .getType('EnumWithDeprecatedValue')
      .getValue('DEPRECATED');
    expect(deprecatedEnumDef.isDeprecated).to.equal(true);
    expect(deprecatedEnumDef.deprecationReason).to.equal('do not use');
  });

  it('extends objects with deprecated fields', () => {
    const ast = parse(`
      extend type Foo {
        deprecatedField: String @deprecated(reason: "not used anymore")
      }
    `);
    const extendedSchema = extendSchema(testSchema, ast);
    const deprecatedFieldDef = extendedSchema.getType('Foo').getFields()
      .deprecatedField;
    expect(deprecatedFieldDef.isDeprecated).to.equal(true);
    expect(deprecatedFieldDef.deprecationReason).to.equal('not used anymore');
  });

  it('extends objects by adding new unused types', () => {
    const ast = parse(`
      type Unused {
        someField: String
      }
    `);
    const originalPrint = printSchema(testSchema);
    const extendedSchema = extendSchema(testSchema, ast);
    expect(extendedSchema).to.not.equal(testSchema);
    expect(printSchema(testSchema)).to.equal(originalPrint);
    expect(printSchema(extendedSchema)).to.equal(dedent`
      type Bar implements SomeInterface {
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
      }

      type Query {
        foo: Foo
        someUnion: SomeUnion
        someEnum: SomeEnum
        someInterface(id: ID!): SomeInterface
      }

      enum SomeEnum {
        ONE
        TWO
      }

      interface SomeInterface {
        name: String
        some: SomeInterface
      }

      union SomeUnion = Foo | Biz

      type Unused {
        someField: String
      }
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
    expect(printSchema(extendedSchema)).to.equal(dedent`
      type Bar implements SomeInterface {
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
        someEnum: SomeEnum
        someInterface(id: ID!): SomeInterface
      }

      enum SomeEnum {
        ONE
        TWO
      }

      interface SomeInterface {
        name: String
        some: SomeInterface
      }

      union SomeUnion = Foo | Biz
    `);
  });

  it('extends objects by adding new fields with existing types', () => {
    const ast = parse(`
      extend type Foo {
        newField(arg1: SomeEnum!): SomeEnum
      }
    `);
    const originalPrint = printSchema(testSchema);
    const extendedSchema = extendSchema(testSchema, ast);
    expect(extendedSchema).to.not.equal(testSchema);
    expect(printSchema(testSchema)).to.equal(originalPrint);
    expect(printSchema(extendedSchema)).to.equal(dedent`
      type Bar implements SomeInterface {
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
        newField(arg1: SomeEnum!): SomeEnum
      }

      type Query {
        foo: Foo
        someUnion: SomeUnion
        someEnum: SomeEnum
        someInterface(id: ID!): SomeInterface
      }

      enum SomeEnum {
        ONE
        TWO
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
    expect(printSchema(extendedSchema)).to.equal(dedent`
      type Bar implements SomeInterface {
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
        someEnum: SomeEnum
        someInterface(id: ID!): SomeInterface
      }

      enum SomeEnum {
        ONE
        TWO
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
    expect(printSchema(extendedSchema)).to.equal(dedent`
      type Bar implements SomeInterface {
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
        someEnum: SomeEnum
        someInterface(id: ID!): SomeInterface
      }

      enum SomeEnum {
        ONE
        TWO
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
    expect(printSchema(extendedSchema)).to.equal(dedent`
      type Bar implements SomeInterface {
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
        someEnum: SomeEnum
        someInterface(id: ID!): SomeInterface
      }

      enum SomeEnum {
        ONE
        TWO
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
    expect(printSchema(extendedSchema)).to.equal(dedent`
      type Bar implements SomeInterface {
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
        someEnum: SomeEnum
        someInterface(id: ID!): SomeInterface
      }

      enum SomeEnum {
        ONE
        TWO
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
        }),
      }),
      mutation: new GraphQLObjectType({
        name: 'Mutation',
        fields: () => ({
          mutationField: { type: GraphQLString },
        }),
      }),
      subscription: new GraphQLObjectType({
        name: 'Subscription',
        fields: () => ({
          subscriptionField: { type: GraphQLString },
        }),
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
    expect(printSchema(extendedSchema)).to.equal(dedent`
      type Mutation {
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

  it('may extend directives with new simple directive', () => {
    const ast = parse(`
      directive @neat on QUERY
    `);

    const extendedSchema = extendSchema(testSchema, ast);
    const newDirective = extendedSchema.getDirective('neat');
    expect(newDirective.name).to.equal('neat');
    expect(newDirective.locations).to.contain('QUERY');
  });

  it('sets correct description when extending with a new directive', () => {
    const ast = parse(`
      # new directive
      directive @new on QUERY
    `);

    const extendedSchema = extendSchema(testSchema, ast);
    const newDirective = extendedSchema.getDirective('new');
    expect(newDirective.description).to.equal('new directive');
  });

  it('may extend directives with new complex directive', () => {
    const ast = parse(`
      directive @profile(enable: Boolean! tag: String) on QUERY | FIELD
    `);

    const extendedSchema = extendSchema(testSchema, ast);
    const extendedDirective = extendedSchema.getDirective('profile');
    expect(extendedDirective.locations).to.contain('QUERY');
    expect(extendedDirective.locations).to.contain('FIELD');

    const args = extendedDirective.args;
    const arg0 = args[0];
    const arg1 = args[1];

    expect(args.length).to.equal(2);
    expect(arg0.name).to.equal('enable');
    expect(arg0.type).to.be.instanceof(GraphQLNonNull);
    expect(arg0.type.ofType).to.be.instanceof(GraphQLScalarType);

    expect(arg1.name).to.equal('tag');
    expect(arg1.type).to.be.instanceof(GraphQLScalarType);
  });

  it('does not allow replacing a default directive', () => {
    const ast = parse(`
      directive @include(if: Boolean!) on FIELD | FRAGMENT_SPREAD
    `);

    expect(() => extendSchema(testSchema, ast)).to.throw(
      'Directive "include" already exists in the schema. It cannot be ' +
        'redefined.',
    );
  });

  it('does not allow replacing a custom directive', () => {
    const ast = parse(`
      directive @meow(if: Boolean!) on FIELD | FRAGMENT_SPREAD
    `);

    const extendedSchema = extendSchema(testSchema, ast);

    const replacementAst = parse(`
      directive @meow(if: Boolean!) on FIELD | QUERY
    `);

    expect(() => extendSchema(extendedSchema, replacementAst)).to.throw(
      'Directive "meow" already exists in the schema. It cannot be ' +
        'redefined.',
    );
  });

  it('does not allow replacing an existing type', () => {
    const ast = parse(`
      type Bar {
        baz: String
      }
    `);
    expect(() => extendSchema(testSchema, ast)).to.throw(
      'Type "Bar" already exists in the schema. It cannot also be defined ' +
        'in this type definition.',
    );
  });

  it('does not allow replacing an existing field', () => {
    const ast = parse(`
      extend type Bar {
        foo: Foo
      }
    `);
    expect(() => extendSchema(testSchema, ast)).to.throw(
      'Field "Bar.foo" already exists in the schema. It cannot also be ' +
        'defined in this type extension.',
    );
  });

  it('does not allow implementing an existing interface', () => {
    const ast = parse(`
      extend type Foo implements SomeInterface {
        otherField: String
      }
    `);
    expect(() => extendSchema(testSchema, ast)).to.throw(
      'Type "Foo" already implements "SomeInterface". It cannot also be ' +
        'implemented in this type extension.',
    );
  });

  it('does not allow referencing an unknown type', () => {
    const ast = parse(`
      extend type Bar {
        quix: Quix
      }
    `);
    expect(() => extendSchema(testSchema, ast)).to.throw(
      'Unknown type: "Quix". Ensure that this type exists either in the ' +
        'original schema, or is added in a type definition.',
    );
  });

  it('does not allow extending an unknown type', () => {
    const ast = parse(`
      extend type UnknownType {
        baz: String
      }
    `);
    expect(() => extendSchema(testSchema, ast)).to.throw(
      'Cannot extend type "UnknownType" because it does not exist in the ' +
        'existing schema.',
    );
  });

  describe('does not allow extending a non-object type', () => {
    it('not an interface', () => {
      const ast = parse(`
        extend type SomeInterface {
          baz: String
        }
      `);
      expect(() => extendSchema(testSchema, ast)).to.throw(
        'Cannot extend non-object type "SomeInterface".',
      );
    });

    it('not a scalar', () => {
      const ast = parse(`
        extend type String {
          baz: String
        }
      `);
      expect(() => extendSchema(testSchema, ast)).to.throw(
        'Cannot extend non-object type "String".',
      );
    });
  });
});
