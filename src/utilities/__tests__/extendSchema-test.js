/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import dedent from '../../jsutils/dedent';
import { extendSchema } from '../extendSchema';
import { parse, print, DirectiveLocation } from '../../language';
import { printSchema } from '../schemaPrinter';
import { Kind } from '../../language/kinds';
import { graphqlSync } from '../../';
import {
  GraphQLSchema,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLID,
  GraphQLString,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLList,
  GraphQLDirective,
  isScalarType,
  isNonNullType,
  validateSchema,
  specifiedDirectives,
} from '../../type';

// Test schema.
const SomeScalarType = new GraphQLScalarType({
  name: 'SomeScalar',
  serialize: x => x,
});

const SomeInterfaceType = new GraphQLInterfaceType({
  name: 'SomeInterface',
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
    tree: { type: GraphQLNonNull(GraphQLList(FooType)) },
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
  types: [FooType, BizType],
});

const SomeEnumType = new GraphQLEnumType({
  name: 'SomeEnum',
  values: {
    ONE: { value: 1 },
    TWO: { value: 2 },
  },
});

const SomeInputType = new GraphQLInputObjectType({
  name: 'SomeInput',
  fields: () => ({
    fooArg: { type: GraphQLString },
  }),
});

const FooDirective = new GraphQLDirective({
  name: 'foo',
  args: {
    input: { type: SomeInputType },
  },
  locations: [
    DirectiveLocation.SCHEMA,
    DirectiveLocation.SCALAR,
    DirectiveLocation.OBJECT,
    DirectiveLocation.FIELD_DEFINITION,
    DirectiveLocation.ARGUMENT_DEFINITION,
    DirectiveLocation.INTERFACE,
    DirectiveLocation.UNION,
    DirectiveLocation.ENUM,
    DirectiveLocation.ENUM_VALUE,
    DirectiveLocation.INPUT_OBJECT,
    DirectiveLocation.INPUT_FIELD_DEFINITION,
  ],
});

const testSchema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: () => ({
      foo: { type: FooType },
      someScalar: { type: SomeScalarType },
      someUnion: { type: SomeUnionType },
      someEnum: { type: SomeEnumType },
      someInterface: {
        args: { id: { type: GraphQLNonNull(GraphQLID) } },
        type: SomeInterfaceType,
      },
      someInput: {
        args: { input: { type: SomeInputType } },
        type: GraphQLString,
      },
    }),
  }),
  types: [FooType, BarType],
  directives: specifiedDirectives.concat([FooDirective]),
});

function extendTestSchema(sdl, options) {
  const originalPrint = printSchema(testSchema);
  const ast = parse(sdl);
  const extendedSchema = extendSchema(testSchema, ast, options);
  expect(printSchema(testSchema)).to.equal(originalPrint);
  return extendedSchema;
}

const testSchemaAST = parse(printSchema(testSchema));
const testSchemaDefinions = testSchemaAST.definitions.map(print);

function printTestSchemaChanges(extendedSchema) {
  const ast = parse(printSchema(extendedSchema));
  ast.definitions = ast.definitions.filter(
    node => !testSchemaDefinions.includes(print(node)),
  );
  return print(ast);
}

describe('extendSchema', () => {
  it('returns the original schema when there are no type definitions', () => {
    const extendedSchema = extendTestSchema('{ field }');
    expect(extendedSchema).to.equal(testSchema);
  });

  it('extends without altering original schema', () => {
    const extendedSchema = extendTestSchema(`
      extend type Query {
        newField: String
      }
    `);
    expect(extendedSchema).to.not.equal(testSchema);
    expect(printSchema(extendedSchema)).to.contain('newField');
    expect(printSchema(testSchema)).to.not.contain('newField');
  });

  it('can be used for limited execution', () => {
    const extendedSchema = extendTestSchema(`
      extend type Query {
        newField: String
      }
    `);

    const result = graphqlSync(extendedSchema, '{ newField }', {
      newField: 123,
    });
    expect(result).to.deep.equal({
      data: { newField: '123' },
    });
  });

  it('can describe the extended fields', () => {
    const extendedSchema = extendTestSchema(`
      extend type Query {
        "New field description."
        newField: String
      }
    `);

    expect(
      extendedSchema.getType('Query').getFields().newField.description,
    ).to.equal('New field description.');
  });

  it('can describe the extended fields with legacy comments', () => {
    const extendedSchema = extendTestSchema(
      `extend type Query {
        # New field description.
        newField: String
      }`,
      { commentDescriptions: true },
    );

    expect(
      extendedSchema.getType('Query').getFields().newField.description,
    ).to.equal('New field description.');
  });

  it('describes extended fields with strings when present', () => {
    const extendedSchema = extendTestSchema(
      `extend type Query {
        # New field description.
        "Actually use this description."
        newField: String
      }`,
      { commentDescriptions: true },
    );

    expect(
      extendedSchema.getType('Query').getFields().newField.description,
    ).to.equal('Actually use this description.');
  });

  it('extends objects by adding new fields', () => {
    const extendedSchema = extendTestSchema(`
      extend type Foo {
        newField: String
      }
    `);
    expect(printTestSchemaChanges(extendedSchema)).to.equal(dedent`
      type Foo implements SomeInterface {
        name: String
        some: SomeInterface
        tree: [Foo]!
        newField: String
      }
    `);

    const fooType = extendedSchema.getType('Foo');
    const fooField = extendedSchema.getType('Query').getFields()['foo'];
    expect(fooField.type).to.equal(fooType);
  });

  it('extends enums by adding new values', () => {
    const extendedSchema = extendTestSchema(`
      extend enum SomeEnum {
        NEW_ENUM
      }
    `);
    expect(printTestSchemaChanges(extendedSchema)).to.equal(dedent`
      enum SomeEnum {
        ONE
        TWO
        NEW_ENUM
      }
    `);

    const someEnumType = extendedSchema.getType('SomeEnum');
    const enumField = extendedSchema.getType('Query').getFields()['someEnum'];
    expect(enumField.type).to.equal(someEnumType);
  });

  it('extends unions by adding new types', () => {
    const extendedSchema = extendTestSchema(`
      extend union SomeUnion = Bar
    `);
    expect(printTestSchemaChanges(extendedSchema)).to.equal(dedent`
      union SomeUnion = Foo | Biz | Bar
    `);

    const someUnionType = extendedSchema.getType('SomeUnion');
    const unionField = extendedSchema.getType('Query').getFields()['someUnion'];
    expect(unionField.type).to.equal(someUnionType);
  });

  it('allows extension of union by adding itself', () => {
    const extendedSchema = extendTestSchema(`
      extend union SomeUnion = SomeUnion
    `);

    const errors = validateSchema(extendedSchema);
    expect(errors.length).to.be.above(0);

    expect(printTestSchemaChanges(extendedSchema)).to.equal(dedent`
      union SomeUnion = Foo | Biz | SomeUnion
    `);
  });

  it('extends inputs by adding new fields', () => {
    const extendedSchema = extendTestSchema(`
      extend input SomeInput {
        newField: String
      }
    `);
    expect(printTestSchemaChanges(extendedSchema)).to.equal(dedent`
      input SomeInput {
        fooArg: String
        newField: String
      }
    `);

    const someInputType = extendedSchema.getType('SomeInput');
    const inputField = extendedSchema.getType('Query').getFields()['someInput'];
    expect(inputField.args[0].type).to.equal(someInputType);

    const fooDirective = extendedSchema.getDirective('foo');
    expect(fooDirective.args[0].type).to.equal(someInputType);
  });

  it('extends scalars by adding new directives', () => {
    const extendedSchema = extendTestSchema(`
      extend scalar SomeScalar @foo
    `);

    const someScalar = extendedSchema.getType('SomeScalar');
    expect(someScalar.extensionASTNodes).to.have.lengthOf(1);
    expect(print(someScalar.extensionASTNodes[0])).to.equal(
      'extend scalar SomeScalar @foo',
    );
  });

  it('correctly assign AST nodes to new and extended types', () => {
    const extendedSchema = extendTestSchema(`
      extend type Query {
        newField(testArg: TestInput): TestEnum
      }

      extend scalar SomeScalar @foo

      extend enum SomeEnum {
        NEW_VALUE
      }

      extend union SomeUnion = Bar

      extend input SomeInput {
        newField: String
      }

      extend interface SomeInterface {
        newField: String
      }

      enum TestEnum {
        TEST_VALUE
      }

      input TestInput {
        testInputField: TestEnum
      }
    `);
    const ast = parse(`
      extend type Query {
        oneMoreNewField: TestUnion
      }

      extend scalar SomeScalar @test

      extend enum SomeEnum {
        ONE_MORE_NEW_VALUE
      }

      extend union SomeUnion = TestType

      extend input SomeInput {
        oneMoreNewField: String
      }

      extend interface SomeInterface {
        oneMoreNewField: String
      }

      union TestUnion = TestType

      interface TestInterface {
        interfaceField: String
      }

      type TestType implements TestInterface {
        interfaceField: String
      }

      directive @test(arg: Int) on FIELD | SCALAR
    `);
    const extendedTwiceSchema = extendSchema(extendedSchema, ast);

    const query = extendedTwiceSchema.getType('Query');
    const someScalar = extendedTwiceSchema.getType('SomeScalar');
    const someEnum = extendedTwiceSchema.getType('SomeEnum');
    const someUnion = extendedTwiceSchema.getType('SomeUnion');
    const someInput = extendedTwiceSchema.getType('SomeInput');
    const someInterface = extendedTwiceSchema.getType('SomeInterface');

    const testInput = extendedTwiceSchema.getType('TestInput');
    const testEnum = extendedTwiceSchema.getType('TestEnum');
    const testUnion = extendedTwiceSchema.getType('TestUnion');
    const testInterface = extendedTwiceSchema.getType('TestInterface');
    const testType = extendedTwiceSchema.getType('TestType');
    const testDirective = extendedTwiceSchema.getDirective('test');

    expect(query.extensionASTNodes).to.have.lengthOf(2);
    expect(someScalar.extensionASTNodes).to.have.lengthOf(2);
    expect(someEnum.extensionASTNodes).to.have.lengthOf(2);
    expect(someUnion.extensionASTNodes).to.have.lengthOf(2);
    expect(someInput.extensionASTNodes).to.have.lengthOf(2);
    expect(someInterface.extensionASTNodes).to.have.lengthOf(2);

    expect(testType.extensionASTNodes).to.equal(undefined);
    expect(testEnum.extensionASTNodes).to.equal(undefined);
    expect(testUnion.extensionASTNodes).to.equal(undefined);
    expect(testInput.extensionASTNodes).to.equal(undefined);
    expect(testInterface.extensionASTNodes).to.equal(undefined);

    const restoredExtensionAST = {
      kind: Kind.DOCUMENT,
      definitions: [
        ...query.extensionASTNodes,
        ...someScalar.extensionASTNodes,
        ...someEnum.extensionASTNodes,
        ...someUnion.extensionASTNodes,
        ...someInput.extensionASTNodes,
        ...someInterface.extensionASTNodes,
        testInput.astNode,
        testEnum.astNode,
        testUnion.astNode,
        testInterface.astNode,
        testType.astNode,
        testDirective.astNode,
      ],
    };
    expect(
      printSchema(extendSchema(testSchema, restoredExtensionAST)),
    ).to.be.equal(printSchema(extendedTwiceSchema));

    const newField = query.getFields().newField;
    expect(print(newField.astNode)).to.equal(
      'newField(testArg: TestInput): TestEnum',
    );
    expect(print(newField.args[0].astNode)).to.equal('testArg: TestInput');
    expect(print(query.getFields().oneMoreNewField.astNode)).to.equal(
      'oneMoreNewField: TestUnion',
    );
    expect(print(someEnum.getValue('NEW_VALUE').astNode)).to.equal('NEW_VALUE');
    expect(print(someEnum.getValue('ONE_MORE_NEW_VALUE').astNode)).to.equal(
      'ONE_MORE_NEW_VALUE',
    );
    expect(print(someInput.getFields().newField.astNode)).to.equal(
      'newField: String',
    );
    expect(print(someInput.getFields().oneMoreNewField.astNode)).to.equal(
      'oneMoreNewField: String',
    );
    expect(print(someInterface.getFields().newField.astNode)).to.equal(
      'newField: String',
    );
    expect(print(someInterface.getFields().oneMoreNewField.astNode)).to.equal(
      'oneMoreNewField: String',
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
    const extendedSchema = extendTestSchema(`
      type TypeWithDeprecatedField {
        newDeprecatedField: String @deprecated(reason: "not used anymore")
      }

      enum EnumWithDeprecatedValue {
        DEPRECATED @deprecated(reason: "do not use")
      }
    `);
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
    const extendedSchema = extendTestSchema(`
      extend type Foo {
        deprecatedField: String @deprecated(reason: "not used anymore")
      }
    `);
    const deprecatedFieldDef = extendedSchema.getType('Foo').getFields()
      .deprecatedField;
    expect(deprecatedFieldDef.isDeprecated).to.equal(true);
    expect(deprecatedFieldDef.deprecationReason).to.equal('not used anymore');
  });

  it('extends enums with deprecated values', () => {
    const extendedSchema = extendTestSchema(`
      extend enum SomeEnum {
        DEPRECATED @deprecated(reason: "do not use")
      }
    `);

    const deprecatedEnumDef = extendedSchema
      .getType('SomeEnum')
      .getValue('DEPRECATED');
    expect(deprecatedEnumDef.isDeprecated).to.equal(true);
    expect(deprecatedEnumDef.deprecationReason).to.equal('do not use');
  });

  it('adds new unused object type', () => {
    const extendedSchema = extendTestSchema(`
      type Unused {
        someField: String
      }
    `);
    expect(extendedSchema).to.not.equal(testSchema);
    expect(printTestSchemaChanges(extendedSchema)).to.equal(dedent`
      type Unused {
        someField: String
      }
    `);
  });

  it('adds new unused enum type', () => {
    const extendedSchema = extendTestSchema(`
      enum UnusedEnum {
        SOME
      }
    `);
    expect(extendedSchema).to.not.equal(testSchema);
    expect(printTestSchemaChanges(extendedSchema)).to.equal(dedent`
      enum UnusedEnum {
        SOME
      }
    `);
  });

  it('adds new unused input object type', () => {
    const extendedSchema = extendTestSchema(`
      input UnusedInput {
        someInput: String
      }
    `);
    expect(extendedSchema).to.not.equal(testSchema);
    expect(printTestSchemaChanges(extendedSchema)).to.equal(dedent`
      input UnusedInput {
        someInput: String
      }
    `);
  });

  it('adds new union using new object type', () => {
    const extendedSchema = extendTestSchema(`
      type DummyUnionMember {
        someField: String
      }

      union UnusedUnion = DummyUnionMember
    `);
    expect(extendedSchema).to.not.equal(testSchema);
    expect(printTestSchemaChanges(extendedSchema)).to.equal(dedent`
      type DummyUnionMember {
        someField: String
      }

      union UnusedUnion = DummyUnionMember
    `);
  });

  it('extends objects by adding new fields with arguments', () => {
    const extendedSchema = extendTestSchema(`
      extend type Foo {
        newField(arg1: String, arg2: NewInputObj!): String
      }

      input NewInputObj {
        field1: Int
        field2: [Float]
        field3: String!
      }
    `);
    expect(printTestSchemaChanges(extendedSchema)).to.equal(dedent`
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
    `);
  });

  it('extends objects by adding new fields with existing types', () => {
    const extendedSchema = extendTestSchema(`
      extend type Foo {
        newField(arg1: SomeEnum!): SomeEnum
      }
    `);
    expect(printTestSchemaChanges(extendedSchema)).to.equal(dedent`
      type Foo implements SomeInterface {
        name: String
        some: SomeInterface
        tree: [Foo]!
        newField(arg1: SomeEnum!): SomeEnum
      }
    `);
  });

  it('extends objects by adding implemented interfaces', () => {
    const extendedSchema = extendTestSchema(`
      extend type Biz implements SomeInterface {
        name: String
        some: SomeInterface
      }
    `);
    expect(printTestSchemaChanges(extendedSchema)).to.equal(dedent`
      type Biz implements SomeInterface {
        fizz: String
        name: String
        some: SomeInterface
      }
    `);
  });

  it('extends objects by including new types', () => {
    const extendedSchema = extendTestSchema(`
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
    expect(printTestSchemaChanges(extendedSchema)).to.equal(dedent`
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
    `);
  });

  it('extends objects by adding implemented new interfaces', () => {
    const extendedSchema = extendTestSchema(`
      extend type Foo implements NewInterface {
        baz: String
      }

      interface NewInterface {
        baz: String
      }
    `);
    expect(printTestSchemaChanges(extendedSchema)).to.equal(dedent`
      type Foo implements SomeInterface & NewInterface {
        name: String
        some: SomeInterface
        tree: [Foo]!
        baz: String
      }

      interface NewInterface {
        baz: String
      }
    `);
  });

  it('extends different types multiple times', () => {
    const extendedSchema = extendTestSchema(`
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

      extend enum SomeEnum {
        THREE
      }

      extend enum SomeEnum {
        FOUR
      }

      extend union SomeUnion = Boo

      extend union SomeUnion = Joo

      type Boo {
        fieldA: String
      }

      type Joo {
        fieldB: String
      }

      extend input SomeInput {
        fieldA: String
      }

      extend input SomeInput {
        fieldB: String
      }
    `);
    expect(printTestSchemaChanges(extendedSchema)).to.equal(dedent`
      type Biz implements NewInterface & SomeInterface {
        fizz: String
        buzz: String
        name: String
        some: SomeInterface
        newFieldA: Int
        newFieldB: Float
      }

      type Boo {
        fieldA: String
      }

      type Joo {
        fieldB: String
      }

      interface NewInterface {
        buzz: String
      }

      enum SomeEnum {
        ONE
        TWO
        THREE
        FOUR
      }

      input SomeInput {
        fooArg: String
        fieldA: String
        fieldB: String
      }

      union SomeUnion = Foo | Biz | Boo | Joo
    `);
  });

  it('extends interfaces by adding new fields', () => {
    const extendedSchema = extendTestSchema(`
      extend interface SomeInterface {
        newField: String
      }

      extend type Bar {
        newField: String
      }

      extend type Foo {
        newField: String
      }
    `);
    expect(printTestSchemaChanges(extendedSchema)).to.equal(dedent`
      type Bar implements SomeInterface {
        name: String
        some: SomeInterface
        foo: Foo
        newField: String
      }

      type Foo implements SomeInterface {
        name: String
        some: SomeInterface
        tree: [Foo]!
        newField: String
      }

      interface SomeInterface {
        name: String
        some: SomeInterface
        newField: String
      }
    `);
  });

  it('allows extension of interface with missing Object fields', () => {
    const extendedSchema = extendTestSchema(`
      extend interface SomeInterface {
        newField: String
      }
    `);

    const errors = validateSchema(extendedSchema);
    expect(errors.length).to.be.above(0);

    expect(printTestSchemaChanges(extendedSchema)).to.equal(dedent`
      interface SomeInterface {
        name: String
        some: SomeInterface
        newField: String
      }
    `);
  });

  it('extends interfaces multiple times', () => {
    const extendedSchema = extendTestSchema(`
      extend interface SomeInterface {
        newFieldA: Int
      }

      extend interface SomeInterface {
        newFieldB(test: Boolean): String
      }
    `);
    expect(printTestSchemaChanges(extendedSchema)).to.equal(dedent`
      interface SomeInterface {
        name: String
        some: SomeInterface
        newFieldA: Int
        newFieldB(test: Boolean): String
      }
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
    const extendedSchema = extendTestSchema(`
      directive @neat on QUERY
    `);

    const newDirective = extendedSchema.getDirective('neat');
    expect(newDirective.name).to.equal('neat');
    expect(newDirective.locations).to.contain('QUERY');
  });

  it('sets correct description when extending with a new directive', () => {
    const extendedSchema = extendTestSchema(`
      """
      new directive
      """
      directive @new on QUERY
    `);

    const newDirective = extendedSchema.getDirective('new');
    expect(newDirective.description).to.equal('new directive');
  });

  it('sets correct description using legacy comments', () => {
    const extendedSchema = extendTestSchema(
      `
      # new directive
      directive @new on QUERY
    `,
      { commentDescriptions: true },
    );

    const newDirective = extendedSchema.getDirective('new');
    expect(newDirective.description).to.equal('new directive');
  });

  it('may extend directives with new complex directive', () => {
    const extendedSchema = extendTestSchema(`
      directive @profile(enable: Boolean! tag: String) on QUERY | FIELD
    `);

    const extendedDirective = extendedSchema.getDirective('profile');
    expect(extendedDirective.locations).to.contain('QUERY');
    expect(extendedDirective.locations).to.contain('FIELD');

    const args = extendedDirective.args;
    const arg0 = args[0];
    const arg1 = args[1];

    expect(args.length).to.equal(2);
    expect(arg0.name).to.equal('enable');
    expect(isNonNullType(arg0.type)).to.equal(true);
    expect(isScalarType(arg0.type.ofType)).to.equal(true);

    expect(arg1.name).to.equal('tag');
    expect(isScalarType(arg1.type)).to.equal(true);
  });

  it('does not allow replacing a default directive', () => {
    const sdl = `
      directive @include(if: Boolean!) on FIELD | FRAGMENT_SPREAD
    `;

    expect(() => extendTestSchema(sdl)).to.throw(
      'Directive "include" already exists in the schema. It cannot be ' +
        'redefined.',
    );
  });

  it('does not allow replacing a custom directive', () => {
    const extendedSchema = extendTestSchema(`
      directive @meow(if: Boolean!) on FIELD | FRAGMENT_SPREAD
    `);

    const replacementAST = parse(`
      directive @meow(if: Boolean!) on FIELD | QUERY
    `);

    expect(() => extendSchema(extendedSchema, replacementAST)).to.throw(
      'Directive "meow" already exists in the schema. It cannot be redefined.',
    );
  });

  it('does not allow replacing an existing type', () => {
    const existingTypeError = type =>
      `Type "${type}" already exists in the schema.` +
      ' It cannot also be defined in this type definition.';

    const typeSDL = `
      type Bar
    `;
    expect(() => extendTestSchema(typeSDL)).to.throw(existingTypeError('Bar'));

    const scalarSDL = `
      scalar SomeScalar
    `;
    expect(() => extendTestSchema(scalarSDL)).to.throw(
      existingTypeError('SomeScalar'),
    );

    const interfaceSDL = `
      interface SomeInterface
    `;
    expect(() => extendTestSchema(interfaceSDL)).to.throw(
      existingTypeError('SomeInterface'),
    );

    const enumSDL = `
      enum SomeEnum
    `;
    expect(() => extendTestSchema(enumSDL)).to.throw(
      existingTypeError('SomeEnum'),
    );

    const unionSDL = `
      union SomeUnion
    `;
    expect(() => extendTestSchema(unionSDL)).to.throw(
      existingTypeError('SomeUnion'),
    );

    const inputSDL = `
      input SomeInput
    `;
    expect(() => extendTestSchema(inputSDL)).to.throw(
      existingTypeError('SomeInput'),
    );
  });

  it('does not allow replacing an existing field', () => {
    const existingFieldError = (type, field) =>
      `Field "${type}.${field}" already exists in the schema.` +
      ' It cannot also be defined in this type extension.';

    const typeSDL = `
      extend type Bar {
        foo: Foo
      }
    `;
    expect(() => extendTestSchema(typeSDL)).to.throw(
      existingFieldError('Bar', 'foo'),
    );

    const interfaceSDL = `
      extend interface SomeInterface {
        some: Foo
      }
    `;
    expect(() => extendTestSchema(interfaceSDL)).to.throw(
      existingFieldError('SomeInterface', 'some'),
    );

    const inputSDL = `
      extend input SomeInput {
        fooArg: String
      }
    `;
    expect(() => extendTestSchema(inputSDL)).to.throw(
      existingFieldError('SomeInput', 'fooArg'),
    );
  });

  it('does not allow replacing an existing enum value', () => {
    const sdl = `
      extend enum SomeEnum {
        ONE
      }
    `;
    expect(() => extendTestSchema(sdl)).to.throw(
      'Enum value "SomeEnum.ONE" already exists in the schema. It cannot ' +
        'also be defined in this type extension.',
    );
  });

  it('does not allow referencing an unknown type', () => {
    const unknownTypeError =
      'Unknown type: "Quix". Ensure that this type exists either in the ' +
      'original schema, or is added in a type definition.';

    const typeSDL = `
      extend type Bar {
        quix: Quix
      }
    `;
    expect(() => extendTestSchema(typeSDL)).to.throw(unknownTypeError);

    const intefaceSDL = `
      extend interface SomeInterface {
        quix: Quix
      }
    `;
    expect(() => extendTestSchema(intefaceSDL)).to.throw(unknownTypeError);

    const unionSDL = `
      extend union SomeUnion = Quix
    `;
    expect(() => extendTestSchema(unionSDL)).to.throw(unknownTypeError);

    const inputSDL = `
      extend input SomeInput {
        quix: Quix
      }
    `;
    expect(() => extendTestSchema(inputSDL)).to.throw(unknownTypeError);
  });

  it('does not allow extending an unknown type', () => {
    [
      'extend scalar UnknownType @foo',
      'extend type UnknownType @foo',
      'extend interface UnknownType @foo',
      'extend enum UnknownType @foo',
      'extend union UnknownType @foo',
      'extend input UnknownType @foo',
    ].forEach(sdl => {
      expect(() => extendTestSchema(sdl)).to.throw(
        'Cannot extend type "UnknownType" because it does not exist in the existing schema.',
      );
    });
  });

  it('maintains configuration of the original schema object', () => {
    const testSchemaWithLegacyNames = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: () => ({
          id: { type: GraphQLID },
        }),
      }),
      allowedLegacyNames: ['__badName'],
    });
    const ast = parse(`
      extend type Query {
        __badName: String
      }
    `);
    const schema = extendSchema(testSchemaWithLegacyNames, ast);
    expect(schema).to.have.deep.property('__allowedLegacyNames', ['__badName']);
  });

  it('adds to the configuration of the original schema object', () => {
    const testSchemaWithLegacyNames = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: () => ({
          __badName: { type: GraphQLString },
        }),
      }),
      allowedLegacyNames: ['__badName'],
    });
    const ast = parse(`
      extend type Query {
        __anotherBadName: String
      }
    `);
    const schema = extendSchema(testSchemaWithLegacyNames, ast, {
      allowedLegacyNames: ['__anotherBadName'],
    });
    expect(schema).to.have.deep.property('__allowedLegacyNames', [
      '__badName',
      '__anotherBadName',
    ]);
  });

  it('does not allow extending a mismatch type', () => {
    const typeSDL = `
      extend type SomeInterface @foo
    `;
    expect(() => extendTestSchema(typeSDL)).to.throw(
      'Cannot extend non-object type "SomeInterface".',
    );

    const interfaceSDL = `
      extend interface Foo @foo
    `;
    expect(() => extendTestSchema(interfaceSDL)).to.throw(
      'Cannot extend non-interface type "Foo".',
    );

    const enumSDL = `
      extend enum Foo @foo
    `;
    expect(() => extendTestSchema(enumSDL)).to.throw(
      'Cannot extend non-enum type "Foo".',
    );

    const unionSDL = `
      extend union Foo @foo
    `;
    expect(() => extendTestSchema(unionSDL)).to.throw(
      'Cannot extend non-union type "Foo".',
    );

    const inputSDL = `
      extend input Foo @foo
    `;
    expect(() => extendTestSchema(inputSDL)).to.throw(
      'Cannot extend non-input object type "Foo".',
    );
  });

  describe('can add additional root operation types', () => {
    it('does not automatically include common root type names', () => {
      const schema = extendTestSchema(`
        type Mutation {
          doSomething: String
        }
      `);
      expect(schema.getMutationType()).to.equal(null);
    });

    it('does not allow overriding schema within an extension', () => {
      const sdl = `
        schema {
          mutation: Mutation
        }

        type Mutation {
          doSomething: String
        }
      `;
      expect(() => extendTestSchema(sdl)).to.throw(
        'Cannot define a new schema within a schema extension.',
      );
    });

    it('adds schema definition missing in the original schema', () => {
      let schema = new GraphQLSchema({
        directives: [FooDirective],
        types: [FooType],
      });
      expect(schema.getQueryType()).to.equal(undefined);

      const ast = parse(`
        schema @foo {
          query: Foo
        }
      `);
      schema = extendSchema(schema, ast);
      const queryType = schema.getQueryType();
      expect(queryType).to.have.property('name', 'Foo');
    });

    it('adds new root types via schema extension', () => {
      const schema = extendTestSchema(`
        extend schema {
          mutation: Mutation
        }

        type Mutation {
          doSomething: String
        }
      `);
      const mutationType = schema.getMutationType();
      expect(mutationType).to.have.property('name', 'Mutation');
    });

    it('adds multiple new root types via schema extension', () => {
      const schema = extendTestSchema(`
        extend schema {
          mutation: Mutation
          subscription: Subscription
        }

        type Mutation {
          doSomething: String
        }

        type Subscription {
          hearSomething: String
        }
      `);
      const mutationType = schema.getMutationType();
      const subscriptionType = schema.getSubscriptionType();
      expect(mutationType).to.have.property('name', 'Mutation');
      expect(subscriptionType).to.have.property('name', 'Subscription');
    });

    it('applies multiple schema extensions', () => {
      const schema = extendTestSchema(`
        extend schema {
          mutation: Mutation
        }

        extend schema {
          subscription: Subscription
        }

        type Mutation {
          doSomething: String
        }

        type Subscription {
          hearSomething: String
        }
      `);
      const mutationType = schema.getMutationType();
      const subscriptionType = schema.getSubscriptionType();
      expect(mutationType).to.have.property('name', 'Mutation');
      expect(subscriptionType).to.have.property('name', 'Subscription');
    });

    it('schema extension AST are available from schema object', () => {
      let schema = extendTestSchema(`
        extend schema {
          mutation: Mutation
        }

        extend schema {
          subscription: Subscription
        }

        type Mutation {
          doSomething: String
        }

        type Subscription {
          hearSomething: String
        }
      `);

      const ast = parse(`
        extend schema @foo
      `);
      schema = extendSchema(schema, ast);

      const nodes = schema.extensionASTNodes;
      expect(nodes.map(n => print(n) + '\n').join('')).to.equal(dedent`
        extend schema {
          mutation: Mutation
        }
        extend schema {
          subscription: Subscription
        }
        extend schema @foo
      `);
    });

    it('does not allow redefining an existing root type', () => {
      const sdl = `
        extend schema {
          query: SomeType
        }

        type SomeType {
          seeSomething: String
        }
      `;
      expect(() => extendTestSchema(sdl)).to.throw(
        'Must provide only one query type in schema.',
      );
    });

    it('does not allow defining a root operation type twice', () => {
      const sdl = `
        extend schema {
          mutation: Mutation
        }

        extend schema {
          mutation: Mutation
        }

        type Mutation {
          doSomething: String
        }
      `;
      expect(() => extendTestSchema(sdl)).to.throw(
        'Must provide only one mutation type in schema.',
      );
    });

    it('does not allow defining a root operation type with different types', () => {
      const sdl = `
        extend schema {
          mutation: Mutation
        }

        extend schema {
          mutation: SomethingElse
        }

        type Mutation {
          doSomething: String
        }

        type SomethingElse {
          doSomethingElse: String
        }
      `;
      expect(() => extendTestSchema(sdl)).to.throw(
        'Must provide only one mutation type in schema.',
      );
    });
  });
});
