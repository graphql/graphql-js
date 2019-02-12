/**
 * Copyright (c) 2015-present, Facebook, Inc.
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
import { extendSchema } from '../extendSchema';
import { parse, print, DirectiveLocation } from '../../language';
import { printSchema } from '../schemaPrinter';
import { Kind } from '../../language/kinds';
import { graphqlSync } from '../../';
import {
  assertDirective,
  assertObjectType,
  assertInputObjectType,
  assertEnumType,
  assertUnionType,
  assertInterfaceType,
  assertScalarType,
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
const testSchemaDefinitions = testSchemaAST.definitions.map(print);

function printTestSchemaChanges(extendedSchema) {
  const ast = parse(printSchema(extendedSchema));
  return print({
    kind: Kind.DOCUMENT,
    definitions: ast.definitions.filter(
      node => !testSchemaDefinitions.includes(print(node)),
    ),
  });
}

function printNode(node) {
  invariant(node);
  return print(node);
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
    const queryType = assertObjectType(extendedSchema.getType('Query'));

    expect(queryType.getFields().newField).to.include({
      description: 'New field description.',
    });
  });

  it('can describe the extended fields with legacy comments', () => {
    const extendedSchema = extendTestSchema(
      `extend type Query {
        # New field description.
        newField: String
      }`,
      { commentDescriptions: true },
    );
    const queryType = assertObjectType(extendedSchema.getType('Query'));

    expect(queryType.getFields().newField).to.include({
      description: 'New field description.',
    });
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

    const queryType = assertObjectType(extendedSchema.getType('Query'));
    expect(queryType.getFields().newField).to.include({
      description: 'Actually use this description.',
    });
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

    const fooType = assertObjectType(extendedSchema.getType('Foo'));
    const queryType = assertObjectType(extendedSchema.getType('Query'));
    expect(queryType.getFields().foo).to.include({ type: fooType });
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
    const queryType = assertObjectType(extendedSchema.getType('Query'));
    const enumField = queryType.getFields().someEnum;
    expect(enumField).to.include({ type: someEnumType });
  });

  it('extends unions by adding new types', () => {
    const extendedSchema = extendTestSchema(`
      extend union SomeUnion = Bar
    `);
    expect(printTestSchemaChanges(extendedSchema)).to.equal(dedent`
      union SomeUnion = Foo | Biz | Bar
    `);

    const someUnionType = extendedSchema.getType('SomeUnion');
    const queryType = assertObjectType(extendedSchema.getType('Query'));
    const unionField = queryType.getFields().someUnion;
    expect(unionField).to.include({ type: someUnionType });
  });

  it('allows extension of union by adding itself', () => {
    const extendedSchema = extendTestSchema(`
      extend union SomeUnion = SomeUnion
    `);

    const errors = validateSchema(extendedSchema);
    expect(errors).to.have.lengthOf.above(0);

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
    const queryType = assertObjectType(extendedSchema.getType('Query'));
    const inputField = queryType.getFields().someInput;
    expect(inputField).to.have.nested.property('args[0].type', someInputType);

    const fooDirective = assertDirective(extendedSchema.getDirective('foo'));
    expect(fooDirective.args[0].type).to.equal(someInputType);
  });

  it('extends scalars by adding new directives', () => {
    const extendedSchema = extendTestSchema(`
      extend scalar SomeScalar @foo
    `);

    const someScalar = assertScalarType(extendedSchema.getType('SomeScalar'));
    invariant(someScalar.extensionASTNodes);
    expect(someScalar.extensionASTNodes.map(print)).to.deep.equal([
      'extend scalar SomeScalar @foo',
    ]);
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

    const query = assertObjectType(extendedTwiceSchema.getType('Query'));
    const someEnum = assertEnumType(extendedTwiceSchema.getType('SomeEnum'));
    const someUnion = assertUnionType(extendedTwiceSchema.getType('SomeUnion'));
    const someScalar = assertScalarType(
      extendedTwiceSchema.getType('SomeScalar'),
    );
    const someInput = assertInputObjectType(
      extendedTwiceSchema.getType('SomeInput'),
    );
    const someInterface = assertInterfaceType(
      extendedTwiceSchema.getType('SomeInterface'),
    );

    const testInput = assertInputObjectType(
      extendedTwiceSchema.getType('TestInput'),
    );
    const testEnum = assertEnumType(extendedTwiceSchema.getType('TestEnum'));
    const testUnion = assertUnionType(extendedTwiceSchema.getType('TestUnion'));
    const testType = assertObjectType(extendedTwiceSchema.getType('TestType'));
    const testInterface = assertInterfaceType(
      extendedTwiceSchema.getType('TestInterface'),
    );
    const testDirective = assertDirective(
      extendedTwiceSchema.getDirective('test'),
    );

    expect(testType).to.include({ extensionASTNodes: undefined });
    expect(testEnum).to.include({ extensionASTNodes: undefined });
    expect(testUnion).to.include({ extensionASTNodes: undefined });
    expect(testInput).to.include({ extensionASTNodes: undefined });
    expect(testInterface).to.include({ extensionASTNodes: undefined });

    expect(query.extensionASTNodes).to.have.lengthOf(2);
    expect(someScalar.extensionASTNodes).to.have.lengthOf(2);
    expect(someEnum.extensionASTNodes).to.have.lengthOf(2);
    expect(someUnion.extensionASTNodes).to.have.lengthOf(2);
    expect(someInput.extensionASTNodes).to.have.lengthOf(2);
    expect(someInterface.extensionASTNodes).to.have.lengthOf(2);

    invariant(testInput.astNode);
    invariant(testEnum.astNode);
    invariant(testUnion.astNode);
    invariant(testInterface.astNode);
    invariant(testType.astNode);
    invariant(testDirective.astNode);

    const restoredExtensionAST = {
      kind: Kind.DOCUMENT,
      definitions: [
        testInput.astNode,
        testEnum.astNode,
        testUnion.astNode,
        testInterface.astNode,
        testType.astNode,
        testDirective.astNode,
      ].concat(
        query.extensionASTNodes || [],
        someScalar.extensionASTNodes || [],
        someEnum.extensionASTNodes || [],
        someUnion.extensionASTNodes || [],
        someInput.extensionASTNodes || [],
        someInterface.extensionASTNodes || [],
      ),
    };
    expect(
      printSchema(extendSchema(testSchema, restoredExtensionAST)),
    ).to.be.equal(printSchema(extendedTwiceSchema));

    const newField = query.getFields().newField;
    expect(printNode(newField.astNode)).to.equal(
      'newField(testArg: TestInput): TestEnum',
    );
    expect(printNode(newField.args[0].astNode)).to.equal('testArg: TestInput');
    expect(printNode(query.getFields().oneMoreNewField.astNode)).to.equal(
      'oneMoreNewField: TestUnion',
    );

    const newValue = someEnum.getValue('NEW_VALUE');
    invariant(newValue);
    expect(printNode(newValue.astNode)).to.equal('NEW_VALUE');

    const oneMoreNewValue = someEnum.getValue('ONE_MORE_NEW_VALUE');
    invariant(oneMoreNewValue);
    expect(printNode(oneMoreNewValue.astNode)).to.equal('ONE_MORE_NEW_VALUE');
    expect(printNode(someInput.getFields().newField.astNode)).to.equal(
      'newField: String',
    );
    expect(printNode(someInput.getFields().oneMoreNewField.astNode)).to.equal(
      'oneMoreNewField: String',
    );
    expect(printNode(someInterface.getFields().newField.astNode)).to.equal(
      'newField: String',
    );
    expect(
      printNode(someInterface.getFields().oneMoreNewField.astNode),
    ).to.equal('oneMoreNewField: String');

    expect(printNode(testInput.getFields().testInputField.astNode)).to.equal(
      'testInputField: TestEnum',
    );

    const testValue = testEnum.getValue('TEST_VALUE');
    invariant(testValue);
    expect(printNode(testValue.astNode)).to.equal('TEST_VALUE');

    expect(
      printNode(testInterface.getFields().interfaceField.astNode),
    ).to.equal('interfaceField: String');
    expect(printNode(testType.getFields().interfaceField.astNode)).to.equal(
      'interfaceField: String',
    );
    expect(printNode(testDirective.args[0].astNode)).to.equal('arg: Int');
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

    const deprecatedFieldDef = assertObjectType(
      extendedSchema.getType('TypeWithDeprecatedField'),
    ).getFields().newDeprecatedField;
    expect(deprecatedFieldDef).to.include({
      isDeprecated: true,
      deprecationReason: 'not used anymore',
    });

    const deprecatedEnumDef = assertEnumType(
      extendedSchema.getType('EnumWithDeprecatedValue'),
    ).getValue('DEPRECATED');
    expect(deprecatedEnumDef).to.include({
      isDeprecated: true,
      deprecationReason: 'do not use',
    });
  });

  it('extends objects with deprecated fields', () => {
    const extendedSchema = extendTestSchema(`
      extend type Foo {
        deprecatedField: String @deprecated(reason: "not used anymore")
      }
    `);
    const fooType = assertObjectType(extendedSchema.getType('Foo'));
    expect(fooType.getFields().deprecatedField).to.include({
      isDeprecated: true,
      deprecationReason: 'not used anymore',
    });
  });

  it('extends enums with deprecated values', () => {
    const extendedSchema = extendTestSchema(`
      extend enum SomeEnum {
        DEPRECATED @deprecated(reason: "do not use")
      }
    `);

    const enumType = assertEnumType(extendedSchema.getType('SomeEnum'));
    const deprecatedEnumDef = enumType.getValue('DEPRECATED');
    expect(deprecatedEnumDef).to.include({
      isDeprecated: true,
      deprecationReason: 'do not use',
    });
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
    expect(errors).to.have.lengthOf.above(0);

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
    expect(newDirective).to.deep.include({
      name: 'neat',
      locations: ['QUERY'],
    });
  });

  it('sets correct description when extending with a new directive', () => {
    const extendedSchema = extendTestSchema(`
      """
      new directive
      """
      directive @new on QUERY
    `);

    const newDirective = extendedSchema.getDirective('new');
    expect(newDirective).to.include({ description: 'new directive' });
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
    expect(newDirective).to.include({ description: 'new directive' });
  });

  it('may extend directives with new complex directive', () => {
    const extendedSchema = extendTestSchema(`
      directive @profile(enable: Boolean! tag: String) on QUERY | FIELD
    `);

    const extendedDirective = assertDirective(
      extendedSchema.getDirective('profile'),
    );
    expect(extendedDirective.locations).to.deep.equal(['QUERY', 'FIELD']);

    expect(extendedDirective.args).to.have.lengthOf(2);
    const [arg0, arg1] = extendedDirective.args;

    expect(arg0.name).to.equal('enable');
    expect(String(arg0.type)).to.equal('Boolean!');

    expect(arg1.name).to.equal('tag');
    expect(String(arg1.type)).to.equal('String');
  });

  it('Rejects invalid SDL', () => {
    const sdl = `
      extend schema @unknown
    `;
    expect(() => extendTestSchema(sdl)).to.throw(
      'Unknown directive "unknown".',
    );
  });

  it('Allows to disable SDL validation', () => {
    const sdl = `
      extend schema @unknown
    `;
    extendTestSchema(sdl, { assumeValid: true });
    extendTestSchema(sdl, { assumeValidSDL: true });
  });

  it('does not allow replacing a default directive', () => {
    const sdl = `
      directive @include(if: Boolean!) on FIELD | FRAGMENT_SPREAD
    `;

    expect(() => extendTestSchema(sdl)).to.throw(
      'Directive "include" already exists in the schema. It cannot be redefined.',
    );
  });

  it('does not allow replacing an existing enum value', () => {
    const sdl = `
      extend enum SomeEnum {
        ONE
      }
    `;
    expect(() => extendTestSchema(sdl)).to.throw(
      'Enum value "SomeEnum.ONE" already exists in the schema. It cannot also be defined in this type extension.',
    );
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
    expect(schema).to.deep.include({ __allowedLegacyNames: ['__badName'] });
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
    expect(schema).to.deep.include({
      __allowedLegacyNames: ['__badName', '__anotherBadName'],
    });
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

    it('adds schema definition missing in the original schema', () => {
      let schema = new GraphQLSchema({
        directives: [FooDirective],
        types: [FooType],
      });
      expect(schema.getQueryType()).to.equal(undefined);

      const extensionSDL = dedent`
        schema @foo {
          query: Foo
        }`;
      schema = extendSchema(schema, parse(extensionSDL));

      const queryType = schema.getQueryType();
      expect(queryType).to.include({ name: 'Foo' });
      expect(printNode(schema.astNode)).to.equal(extensionSDL);
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
      expect(mutationType).to.include({ name: 'Mutation' });
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
      expect(mutationType).to.include({ name: 'Mutation' });
      expect(subscriptionType).to.include({ name: 'Subscription' });
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
      expect(mutationType).to.include({ name: 'Mutation' });
      expect(subscriptionType).to.include({ name: 'Subscription' });
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

      const nodes = schema.extensionASTNodes || [];
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
  });
});
