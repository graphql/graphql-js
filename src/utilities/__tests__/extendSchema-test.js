// @flow strict

import { expect } from 'chai';
import { describe, it } from 'mocha';

import dedent from '../../jsutils/dedent';
import invariant from '../../jsutils/invariant';

import { Kind } from '../../language/kinds';
import { parse } from '../../language/parser';
import { print } from '../../language/printer';

import { graphqlSync } from '../../graphql';

import { GraphQLSchema } from '../../type/schema';
import { validateSchema } from '../../type/validate';
import { assertDirective } from '../../type/directives';
import {
  GraphQLID,
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLBoolean,
} from '../../type/scalars';
import {
  assertObjectType,
  assertInputObjectType,
  assertEnumType,
  assertUnionType,
  assertInterfaceType,
  assertScalarType,
  GraphQLObjectType,
} from '../../type/definition';

import { printSchema } from '../schemaPrinter';
import { extendSchema } from '../extendSchema';
import { buildSchema } from '../buildASTSchema';

// Test schema.
const testSchema = buildSchema(`
  scalar SomeScalar

  interface SomeInterface {
    some: SomeInterface
  }

  interface AnotherInterface implements SomeInterface {
    name: String
    some: AnotherInterface
  }

  type Foo implements AnotherInterface & SomeInterface {
    name: String
    some: AnotherInterface
    tree: [Foo]!
  }

  type Bar implements SomeInterface {
    some: SomeInterface
    foo: Foo
  }

  type Biz {
    fizz: String
  }

  union SomeUnion = Foo | Biz

  enum SomeEnum {
    ONE
    TWO
  }

  input SomeInput {
    fooArg: String
  }

  directive @foo(input: SomeInput) repeatable on SCHEMA | SCALAR | OBJECT | FIELD_DEFINITION | ARGUMENT_DEFINITION | INTERFACE | UNION | ENUM | ENUM_VALUE | INPUT_OBJECT | INPUT_FIELD_DEFINITION

  type Query {
    foo: Foo
    someScalar: SomeScalar
    someUnion: SomeUnion
    someEnum: SomeEnum
    someInterface(id: ID!): SomeInterface
    someInput(input: SomeInput): String
  }
`);

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

function printASTNode(obj) {
  invariant(obj != null && obj.astNode != null);
  return print(obj.astNode);
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
      type Foo implements AnotherInterface & SomeInterface {
        name: String
        some: AnotherInterface
        tree: [Foo]!
        newField: String
      }
    `);

    const fooType = assertObjectType(extendedSchema.getType('Foo'));
    const queryType = assertObjectType(extendedSchema.getType('Query'));
    expect(queryType.getFields().foo).to.include({ type: fooType });
  });

  it('extends objects with standard type fields', () => {
    const schema = buildSchema('type Query');

    // String and Boolean are always included through introspection types
    expect(schema.getType('Int')).to.equal(undefined);
    expect(schema.getType('Float')).to.equal(undefined);
    expect(schema.getType('String')).to.equal(GraphQLString);
    expect(schema.getType('Boolean')).to.equal(GraphQLBoolean);
    expect(schema.getType('ID')).to.equal(undefined);

    const extendAST = parse(`
      extend type Query {
        bool: Boolean
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(extendedSchema.getType('Int')).to.equal(undefined);
    expect(extendedSchema.getType('Float')).to.equal(undefined);
    expect(extendedSchema.getType('String')).to.equal(GraphQLString);
    expect(extendedSchema.getType('Boolean')).to.equal(GraphQLBoolean);
    expect(extendedSchema.getType('ID')).to.equal(undefined);

    const extendTwiceAST = parse(`
      extend type Query {
        int: Int
        float: Float
        id: ID
      }
    `);
    const extendedTwiceSchema = extendSchema(schema, extendTwiceAST);

    expect(extendedTwiceSchema.getType('Int')).to.equal(GraphQLInt);
    expect(extendedTwiceSchema.getType('Float')).to.equal(GraphQLFloat);
    expect(extendedTwiceSchema.getType('String')).to.equal(GraphQLString);
    expect(extendedTwiceSchema.getType('Boolean')).to.equal(GraphQLBoolean);
    expect(extendedTwiceSchema.getType('ID')).to.equal(GraphQLID);
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

      directive @test(arg: Int) repeatable on FIELD | SCALAR
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
    expect(printASTNode(newField)).to.equal(
      'newField(testArg: TestInput): TestEnum',
    );
    expect(printASTNode(newField.args[0])).to.equal('testArg: TestInput');
    expect(printASTNode(query.getFields().oneMoreNewField)).to.equal(
      'oneMoreNewField: TestUnion',
    );

    expect(printASTNode(someEnum.getValue('NEW_VALUE'))).to.equal('NEW_VALUE');
    expect(printASTNode(someEnum.getValue('ONE_MORE_NEW_VALUE'))).to.equal(
      'ONE_MORE_NEW_VALUE',
    );

    expect(printASTNode(someInput.getFields().newField)).to.equal(
      'newField: String',
    );
    expect(printASTNode(someInput.getFields().oneMoreNewField)).to.equal(
      'oneMoreNewField: String',
    );
    expect(printASTNode(someInterface.getFields().newField)).to.equal(
      'newField: String',
    );
    expect(printASTNode(someInterface.getFields().oneMoreNewField)).to.equal(
      'oneMoreNewField: String',
    );

    expect(printASTNode(testInput.getFields().testInputField)).to.equal(
      'testInputField: TestEnum',
    );

    expect(printASTNode(testEnum.getValue('TEST_VALUE'))).to.equal(
      'TEST_VALUE',
    );

    expect(printASTNode(testInterface.getFields().interfaceField)).to.equal(
      'interfaceField: String',
    );
    expect(printASTNode(testType.getFields().interfaceField)).to.equal(
      'interfaceField: String',
    );
    expect(printASTNode(testDirective.args[0])).to.equal('arg: Int');
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
      type Foo implements AnotherInterface & SomeInterface {
        name: String
        some: AnotherInterface
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
      type Foo implements AnotherInterface & SomeInterface {
        name: String
        some: AnotherInterface
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
      type Foo implements AnotherInterface & SomeInterface {
        name: String
        some: AnotherInterface
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
      type Foo implements AnotherInterface & SomeInterface & NewInterface {
        name: String
        some: AnotherInterface
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

      extend interface AnotherInterface {
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
      interface AnotherInterface implements SomeInterface {
        name: String
        some: AnotherInterface
        newField: String
      }

      type Bar implements SomeInterface {
        some: SomeInterface
        foo: Foo
        newField: String
      }

      type Foo implements AnotherInterface & SomeInterface {
        name: String
        some: AnotherInterface
        tree: [Foo]!
        newField: String
      }

      interface SomeInterface {
        some: SomeInterface
        newField: String
      }
    `);
  });

  it('extends interfaces by adding new implemted interfaces', () => {
    const extendedSchema = extendTestSchema(`
      interface NewInterface {
        newField: String
      }

      extend interface AnotherInterface implements NewInterface {
        newField: String
      }

      extend type Foo implements NewInterface {
        newField: String
      }
    `);
    expect(printTestSchemaChanges(extendedSchema)).to.equal(dedent`
      interface AnotherInterface implements SomeInterface & NewInterface {
        name: String
        some: AnotherInterface
        newField: String
      }

      type Foo implements AnotherInterface & SomeInterface & NewInterface {
        name: String
        some: AnotherInterface
        tree: [Foo]!
        newField: String
      }
      
      interface NewInterface {
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
      directive @profile(enable: Boolean! tag: String) repeatable on QUERY | FIELD
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
      'Unknown directive "@unknown".',
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
      'Directive "@include" already exists in the schema. It cannot be redefined.',
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

  describe('can add additional root operation types', () => {
    it('does not automatically include common root type names', () => {
      const schema = extendTestSchema(`
        type Mutation
      `);
      expect(schema.getMutationType()).to.equal(undefined);
    });

    it('adds schema definition missing in the original schema', () => {
      let schema = buildSchema(`
        directive @foo on SCHEMA
        type Foo
      `);
      expect(schema.getQueryType()).to.equal(undefined);

      const extensionSDL = dedent`
        schema @foo {
          query: Foo
        }`;
      schema = extendSchema(schema, parse(extensionSDL));

      const queryType = schema.getQueryType();
      expect(queryType).to.include({ name: 'Foo' });
      expect(printASTNode(schema)).to.equal(extensionSDL);
    });

    it('adds new root types via schema extension', () => {
      const schema = extendTestSchema(`
        extend schema {
          mutation: Mutation
        }

        type Mutation
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

        type Mutation
        type Subscription
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
        type Mutation

        extend schema {
          subscription: Subscription
        }
        type Subscription
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
        type Mutation

        extend schema {
          subscription: Subscription
        }
        type Subscription
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
