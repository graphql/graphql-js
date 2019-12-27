// @flow strict

import { expect } from 'chai';
import { describe, it } from 'mocha';

import dedent from '../../jsutils/dedent';
import invariant from '../../jsutils/invariant';

import { Kind } from '../../language/kinds';
import { parse } from '../../language/parser';
import { print } from '../../language/printer';

import { validateSchema } from '../../type/validate';
import {
  assertDirective,
  GraphQLSkipDirective,
  GraphQLIncludeDirective,
  GraphQLDeprecatedDirective,
} from '../../type/directives';
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
} from '../../type/definition';

import { graphqlSync } from '../../graphql';

import { printType, printSchema } from '../schemaPrinter';
import { buildASTSchema, buildSchema } from '../buildASTSchema';

/**
 * This function does a full cycle of going from a string with the contents of
 * the SDL, parsed in a schema AST, materializing that schema AST into an
 * in-memory GraphQLSchema, and then finally printing that object into the SDL
 */
function cycleSDL(sdl, options = {}) {
  const commentDescriptions = options.commentDescriptions || false;
  const ast = parse(sdl);
  const schema = buildASTSchema(ast, options);
  return printSchema(schema, { commentDescriptions });
}

function printASTNode(obj) {
  invariant(obj != null && obj.astNode != null);
  return print(obj.astNode);
}

function printAllASTNodes(obj) {
  invariant(obj.astNode != null && obj.extensionASTNodes != null);
  return print({
    kind: Kind.DOCUMENT,
    definitions: [obj.astNode, ...obj.extensionASTNodes],
  });
}

describe('Schema Builder', () => {
  it('can use built schema for limited execution', () => {
    const schema = buildASTSchema(
      parse(`
        type Query {
          str: String
        }
      `),
    );

    const result = graphqlSync({
      schema,
      source: '{ str }',
      rootValue: { str: 123 },
    });
    expect(result.data).to.deep.equal({ str: '123' });
  });

  it('can build a schema directly from the source', () => {
    const schema = buildSchema(`
      type Query {
        add(x: Int, y: Int): Int
      }
    `);

    const source = '{ add(x: 34, y: 55) }';
    const rootValue = {
      add: ({ x, y }) => x + y,
    };
    expect(graphqlSync({ schema, source, rootValue })).to.deep.equal({
      data: { add: 89 },
    });
  });

  it('Ignores non-type system definitions', () => {
    const sdl = `
      type Query {
        str: String
      }

      fragment SomeFragment on Query {
        str
      }
    `;
    expect(() => buildSchema(sdl)).to.not.throw();
  });

  it('Empty type', () => {
    const sdl = dedent`
      type EmptyType
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Simple type', () => {
    const sdl = dedent`
      type Query {
        str: String
        int: Int
        float: Float
        id: ID
        bool: Boolean
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);

    const schema = buildSchema(sdl);
    // Built-ins are used
    expect(schema.getType('Int')).to.equal(GraphQLInt);
    expect(schema.getType('Float')).to.equal(GraphQLFloat);
    expect(schema.getType('String')).to.equal(GraphQLString);
    expect(schema.getType('Boolean')).to.equal(GraphQLBoolean);
    expect(schema.getType('ID')).to.equal(GraphQLID);
  });

  it('include standard type only if it is used', () => {
    const schema = buildSchema('type Query');

    // String and Boolean are always included through introspection types
    expect(schema.getType('Int')).to.equal(undefined);
    expect(schema.getType('Float')).to.equal(undefined);
    expect(schema.getType('ID')).to.equal(undefined);
  });

  it('With directives', () => {
    const sdl = dedent`
      directive @foo(arg: Int) on FIELD

      directive @repeatableFoo(arg: Int) repeatable on FIELD
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Supports descriptions', () => {
    const sdl = dedent`
      """This is a directive"""
      directive @foo(
        """It has an argument"""
        arg: Int
      ) on FIELD

      """With an enum"""
      enum Color {
        RED

        """Not a creative color"""
        GREEN
        BLUE
      }

      """What a great type"""
      type Query {
        """And a field to boot"""
        str: String
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Supports option for comment descriptions', () => {
    const sdl = dedent`
      # This is a directive
      directive @foo(
        # It has an argument
        arg: Int
      ) on FIELD

      # With an enum
      enum Color {
        RED

        # Not a creative color
        GREEN
        BLUE
      }

      # What a great type
      type Query {
        # And a field to boot
        str: String
      }
    `;
    expect(cycleSDL(sdl, { commentDescriptions: true })).to.equal(sdl);
  });

  it('Maintains @skip & @include', () => {
    const schema = buildSchema('type Query');

    expect(schema.getDirectives()).to.have.lengthOf(3);
    expect(schema.getDirective('skip')).to.equal(GraphQLSkipDirective);
    expect(schema.getDirective('include')).to.equal(GraphQLIncludeDirective);
    expect(schema.getDirective('deprecated')).to.equal(
      GraphQLDeprecatedDirective,
    );
  });

  it('Overriding directives excludes specified', () => {
    const schema = buildSchema(`
      directive @skip on FIELD
      directive @include on FIELD
      directive @deprecated on FIELD_DEFINITION
    `);

    expect(schema.getDirectives()).to.have.lengthOf(3);
    expect(schema.getDirective('skip')).to.not.equal(GraphQLSkipDirective);
    expect(schema.getDirective('include')).to.not.equal(
      GraphQLIncludeDirective,
    );
    expect(schema.getDirective('deprecated')).to.not.equal(
      GraphQLDeprecatedDirective,
    );
  });

  it('Adding directives maintains @skip & @include', () => {
    const schema = buildSchema(`
      directive @foo(arg: Int) on FIELD
    `);

    expect(schema.getDirectives()).to.have.lengthOf(4);
    expect(schema.getDirective('skip')).to.not.equal(undefined);
    expect(schema.getDirective('include')).to.not.equal(undefined);
    expect(schema.getDirective('deprecated')).to.not.equal(undefined);
  });

  it('Type modifiers', () => {
    const sdl = dedent`
      type Query {
        nonNullStr: String!
        listOfStrings: [String]
        listOfNonNullStrings: [String!]
        nonNullListOfStrings: [String]!
        nonNullListOfNonNullStrings: [String!]!
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Recursive type', () => {
    const sdl = dedent`
      type Query {
        str: String
        recurse: Query
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Two types circular', () => {
    const sdl = dedent`
      type TypeOne {
        str: String
        typeTwo: TypeTwo
      }

      type TypeTwo {
        str: String
        typeOne: TypeOne
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Single argument field', () => {
    const sdl = dedent`
      type Query {
        str(int: Int): String
        floatToStr(float: Float): String
        idToStr(id: ID): String
        booleanToStr(bool: Boolean): String
        strToStr(bool: String): String
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Simple type with multiple arguments', () => {
    const sdl = dedent`
      type Query {
        str(int: Int, bool: Boolean): String
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Empty interface', () => {
    const sdl = dedent`
      interface EmptyInterface
    `;

    const definition = parse(sdl).definitions[0];
    expect(
      definition.kind === 'InterfaceTypeDefinition' && definition.interfaces,
    ).to.deep.equal([], 'The interfaces property must be an empty array.');

    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Simple type with interface', () => {
    const sdl = dedent`
      type Query implements WorldInterface {
        str: String
      }

      interface WorldInterface {
        str: String
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Simple interface hierarchy', () => {
    const sdl = dedent`
      schema {
        query: Child
      }

      interface Child implements Parent {
        str: String
      }

      type Hello implements Parent & Child {
        str: String
      }

      interface Parent {
        str: String
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Empty enum', () => {
    const sdl = dedent`
      enum EmptyEnum
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Simple output enum', () => {
    const sdl = dedent`
      enum Hello {
        WORLD
      }

      type Query {
        hello: Hello
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Simple input enum', () => {
    const sdl = dedent`
      enum Hello {
        WORLD
      }

      type Query {
        str(hello: Hello): String
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Multiple value enum', () => {
    const sdl = dedent`
      enum Hello {
        WO
        RLD
      }

      type Query {
        hello: Hello
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Empty union', () => {
    const sdl = dedent`
      union EmptyUnion
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Simple Union', () => {
    const sdl = dedent`
      union Hello = World

      type Query {
        hello: Hello
      }

      type World {
        str: String
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Multiple Union', () => {
    const sdl = dedent`
      union Hello = WorldOne | WorldTwo

      type Query {
        hello: Hello
      }

      type WorldOne {
        str: String
      }

      type WorldTwo {
        str: String
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Can build recursive Union', () => {
    const schema = buildSchema(`
      union Hello = Hello

      type Query {
        hello: Hello
      }
    `);
    const errors = validateSchema(schema);
    expect(errors).to.have.lengthOf.above(0);
  });

  it('Specifying Union type using __typename', () => {
    const schema = buildSchema(`
      type Query {
        fruits: [Fruit]
      }

      union Fruit = Apple | Banana

      type Apple {
        color: String
      }

      type Banana {
        length: Int
      }
    `);

    const source = `
      {
        fruits {
          ... on Apple {
            color
          }
          ... on Banana {
            length
          }
        }
      }
    `;

    const rootValue = {
      fruits: [
        {
          color: 'green',
          __typename: 'Apple',
        },
        {
          length: 5,
          __typename: 'Banana',
        },
      ],
    };

    expect(graphqlSync({ schema, source, rootValue })).to.deep.equal({
      data: {
        fruits: [
          {
            color: 'green',
          },
          {
            length: 5,
          },
        ],
      },
    });
  });

  it('Specifying Interface type using __typename', () => {
    const schema = buildSchema(`
      type Query {
        characters: [Character]
      }

      interface Character {
        name: String!
      }

      type Human implements Character {
        name: String!
        totalCredits: Int
      }

      type Droid implements Character {
        name: String!
        primaryFunction: String
      }
    `);

    const source = `
      {
        characters {
          name
          ... on Human {
            totalCredits
          }
          ... on Droid {
            primaryFunction
          }
        }
      }
    `;

    const rootValue = {
      characters: [
        {
          name: 'Han Solo',
          totalCredits: 10,
          __typename: 'Human',
        },
        {
          name: 'R2-D2',
          primaryFunction: 'Astromech',
          __typename: 'Droid',
        },
      ],
    };

    expect(graphqlSync({ schema, source, rootValue })).to.deep.equal({
      data: {
        characters: [
          {
            name: 'Han Solo',
            totalCredits: 10,
          },
          {
            name: 'R2-D2',
            primaryFunction: 'Astromech',
          },
        ],
      },
    });
  });

  it('Custom Scalar', () => {
    const sdl = dedent`
      scalar CustomScalar

      type Query {
        customScalar: CustomScalar
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Empty Input Object', () => {
    const sdl = dedent`
      input EmptyInputObject
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Simple Input Object', () => {
    const sdl = dedent`
      input Input {
        int: Int
      }

      type Query {
        field(in: Input): String
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Simple argument field with default', () => {
    const sdl = dedent`
      type Query {
        str(int: Int = 2): String
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Custom scalar argument field with default', () => {
    const sdl = dedent`
      scalar CustomScalar

      type Query {
        str(int: CustomScalar = 2): String
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Simple type with mutation', () => {
    const sdl = dedent`
      schema {
        query: HelloScalars
        mutation: Mutation
      }

      type HelloScalars {
        str: String
        int: Int
        bool: Boolean
      }

      type Mutation {
        addHelloScalars(str: String, int: Int, bool: Boolean): HelloScalars
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Simple type with subscription', () => {
    const sdl = dedent`
      schema {
        query: HelloScalars
        subscription: Subscription
      }

      type HelloScalars {
        str: String
        int: Int
        bool: Boolean
      }

      type Subscription {
        subscribeHelloScalars(str: String, int: Int, bool: Boolean): HelloScalars
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Unreferenced type implementing referenced interface', () => {
    const sdl = dedent`
      type Concrete implements Interface {
        key: String
      }

      interface Interface {
        key: String
      }

      type Query {
        interface: Interface
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Unreferenced interface implementing referenced interface', () => {
    const sdl = dedent`
      interface Child implements Parent {
        key: String
      }

      interface Parent {
        key: String
      }

      type Query {
        interfaceField: Parent
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Unreferenced type implementing referenced union', () => {
    const sdl = dedent`
      type Concrete {
        key: String
      }

      type Query {
        union: Union
      }

      union Union = Concrete
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);
  });

  it('Supports @deprecated', () => {
    const sdl = dedent`
      enum MyEnum {
        VALUE
        OLD_VALUE @deprecated
        OTHER_VALUE @deprecated(reason: "Terrible reasons")
      }

      type Query {
        field1: String @deprecated
        field2: Int @deprecated(reason: "Because I said so")
        enum: MyEnum
      }
    `;
    expect(cycleSDL(sdl)).to.equal(sdl);

    const schema = buildSchema(sdl);

    const myEnum = assertEnumType(schema.getType('MyEnum'));

    const value = myEnum.getValue('VALUE');
    expect(value).to.include({ isDeprecated: false });

    const oldValue = myEnum.getValue('OLD_VALUE');
    expect(oldValue).to.include({
      isDeprecated: true,
      deprecationReason: 'No longer supported',
    });

    const otherValue = myEnum.getValue('OTHER_VALUE');
    expect(otherValue).to.include({
      isDeprecated: true,
      deprecationReason: 'Terrible reasons',
    });

    const rootFields = assertObjectType(schema.getType('Query')).getFields();
    expect(rootFields.field1).to.include({
      isDeprecated: true,
      deprecationReason: 'No longer supported',
    });
    expect(rootFields.field2).to.include({
      isDeprecated: true,
      deprecationReason: 'Because I said so',
    });
  });

  it('Correctly extend scalar type', () => {
    const scalarSDL = dedent`
      scalar SomeScalar

      extend scalar SomeScalar @foo

      extend scalar SomeScalar @bar
    `;
    const schema = buildSchema(`
      ${scalarSDL}
      directive @foo on SCALAR
      directive @bar on SCALAR
    `);

    const someScalar = assertScalarType(schema.getType('SomeScalar'));
    expect(printType(someScalar) + '\n').to.equal(dedent`
      scalar SomeScalar
    `);

    expect(printAllASTNodes(someScalar)).to.equal(scalarSDL);
  });

  it('Correctly extend object type', () => {
    const objectSDL = dedent`
      type SomeObject implements Foo {
        first: String
      }

      extend type SomeObject implements Bar {
        second: Int
      }

      extend type SomeObject implements Baz {
        third: Float
      }
    `;
    const schema = buildSchema(`
      ${objectSDL}
      interface Foo
      interface Bar
      interface Baz
    `);

    const someObject = assertObjectType(schema.getType('SomeObject'));
    expect(printType(someObject) + '\n').to.equal(dedent`
      type SomeObject implements Foo & Bar & Baz {
        first: String
        second: Int
        third: Float
      }
    `);

    expect(printAllASTNodes(someObject)).to.equal(objectSDL);
  });

  it('Correctly extend interface type', () => {
    const interfaceSDL = dedent`
      interface SomeInterface {
        first: String
      }

      extend interface SomeInterface {
        second: Int
      }

      extend interface SomeInterface {
        third: Float
      }
    `;
    const schema = buildSchema(interfaceSDL);

    const someInterface = assertInterfaceType(schema.getType('SomeInterface'));
    expect(printType(someInterface) + '\n').to.equal(dedent`
      interface SomeInterface {
        first: String
        second: Int
        third: Float
      }
    `);

    expect(printAllASTNodes(someInterface)).to.equal(interfaceSDL);
  });

  it('Correctly extend union type', () => {
    const unionSDL = dedent`
      union SomeUnion = FirstType

      extend union SomeUnion = SecondType

      extend union SomeUnion = ThirdType
    `;
    const schema = buildSchema(`
      ${unionSDL}
      type FirstType
      type SecondType
      type ThirdType
    `);

    const someUnion = assertUnionType(schema.getType('SomeUnion'));
    expect(printType(someUnion) + '\n').to.equal(dedent`
      union SomeUnion = FirstType | SecondType | ThirdType
    `);

    expect(printAllASTNodes(someUnion)).to.equal(unionSDL);
  });

  it('Correctly extend enum type', () => {
    const enumSDL = dedent`
      enum SomeEnum {
        FIRST
      }

      extend enum SomeEnum {
        SECOND
      }

      extend enum SomeEnum {
        THIRD
      }
    `;
    const schema = buildSchema(enumSDL);

    const someEnum = assertEnumType(schema.getType('SomeEnum'));
    expect(printType(someEnum) + '\n').to.equal(dedent`
      enum SomeEnum {
        FIRST
        SECOND
        THIRD
      }
    `);

    expect(printAllASTNodes(someEnum)).to.equal(enumSDL);
  });

  it('Correctly extend input object type', () => {
    const inputSDL = dedent`
      input SomeInput {
        first: String
      }

      extend input SomeInput {
        second: Int
      }

      extend input SomeInput {
        third: Float
      }
    `;
    const schema = buildSchema(inputSDL);

    const someInput = assertInputObjectType(schema.getType('SomeInput'));
    expect(printType(someInput) + '\n').to.equal(dedent`
      input SomeInput {
        first: String
        second: Int
        third: Float
      }
    `);

    expect(printAllASTNodes(someInput)).to.equal(inputSDL);
  });

  it('Correctly assign AST nodes', () => {
    const sdl = dedent`
      schema {
        query: Query
      }

      type Query {
        testField(testArg: TestInput): TestUnion
      }

      input TestInput {
        testInputField: TestEnum
      }

      enum TestEnum {
        TEST_VALUE
      }

      union TestUnion = TestType

      interface TestInterface {
        interfaceField: String
      }

      type TestType implements TestInterface {
        interfaceField: String
      }

      scalar TestScalar

      directive @test(arg: TestScalar) on FIELD
    `;
    const ast = parse(sdl, { noLocation: true });

    const schema = buildASTSchema(ast);
    const query = assertObjectType(schema.getType('Query'));
    const testInput = assertInputObjectType(schema.getType('TestInput'));
    const testEnum = assertEnumType(schema.getType('TestEnum'));
    const testUnion = assertUnionType(schema.getType('TestUnion'));
    const testInterface = assertInterfaceType(schema.getType('TestInterface'));
    const testType = assertObjectType(schema.getType('TestType'));
    const testScalar = assertScalarType(schema.getType('TestScalar'));
    const testDirective = assertDirective(schema.getDirective('test'));

    expect([
      schema.astNode,
      query.astNode,
      testInput.astNode,
      testEnum.astNode,
      testUnion.astNode,
      testInterface.astNode,
      testType.astNode,
      testScalar.astNode,
      testDirective.astNode,
    ]).to.be.deep.equal(ast.definitions);

    const testField = query.getFields().testField;
    expect(printASTNode(testField)).to.equal(
      'testField(testArg: TestInput): TestUnion',
    );
    expect(printASTNode(testField.args[0])).to.equal('testArg: TestInput');
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
    expect(printASTNode(testDirective.args[0])).to.equal('arg: TestScalar');
  });

  it('Root operation types with custom names', () => {
    const schema = buildSchema(`
      schema {
        query: SomeQuery
        mutation: SomeMutation
        subscription: SomeSubscription
      }
      type SomeQuery
      type SomeMutation
      type SomeSubscription
    `);

    expect(schema.getQueryType()).to.include({ name: 'SomeQuery' });
    expect(schema.getMutationType()).to.include({ name: 'SomeMutation' });
    expect(schema.getSubscriptionType()).to.include({
      name: 'SomeSubscription',
    });
  });

  it('Default root operation type names', () => {
    const schema = buildSchema(`
      type Query
      type Mutation
      type Subscription
    `);

    expect(schema.getQueryType()).to.include({ name: 'Query' });
    expect(schema.getMutationType()).to.include({ name: 'Mutation' });
    expect(schema.getSubscriptionType()).to.include({ name: 'Subscription' });
  });

  it('can build invalid schema', () => {
    // Invalid schema, because it is missing query root type
    const schema = buildSchema('type Mutation');
    const errors = validateSchema(schema);
    expect(errors).to.have.lengthOf.above(0);
  });

  it('Rejects invalid SDL', () => {
    const sdl = `
      type Query {
        foo: String @unknown
      }
    `;
    expect(() => buildSchema(sdl)).to.throw('Unknown directive "@unknown".');
  });

  it('Allows to disable SDL validation', () => {
    const sdl = `
      type Query {
        foo: String @unknown
      }
    `;
    buildSchema(sdl, { assumeValid: true });
    buildSchema(sdl, { assumeValidSDL: true });
  });

  it('Throws on unknown types', () => {
    const sdl = `
      type Query {
        unknown: UnknownType
      }
    `;
    expect(() => buildSchema(sdl, { assumeValidSDL: true })).to.throw(
      'Unknown type: "UnknownType".',
    );
  });

  it('Rejects invalid AST', () => {
    // $DisableFlowOnNegativeTest
    expect(() => buildASTSchema(null)).to.throw(
      'Must provide valid Document AST',
    );

    // $DisableFlowOnNegativeTest
    expect(() => buildASTSchema({})).to.throw(
      'Must provide valid Document AST',
    );
  });
});
