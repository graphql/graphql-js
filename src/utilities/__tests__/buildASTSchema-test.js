/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import invariant from '../../jsutils/invariant';
import { parse, print } from '../../language';
import { printSchema } from '../schemaPrinter';
import { buildASTSchema, buildSchema } from '../buildASTSchema';
import dedent from '../../jsutils/dedent';
import { Kind } from '../../language/kinds';
import {
  assertDirective,
  assertObjectType,
  assertInputObjectType,
  assertEnumType,
  assertUnionType,
  assertInterfaceType,
  assertScalarType,
  graphqlSync,
  validateSchema,
  GraphQLID,
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLBoolean,
  GraphQLSkipDirective,
  GraphQLIncludeDirective,
  GraphQLDeprecatedDirective,
} from '../../';

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

function printNode(node) {
  invariant(node);
  return print(node);
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

    const result = graphqlSync(schema, '{ str }', { str: 123 });
    expect(result.data).to.deep.equal({ str: '123' });
  });

  it('can build a schema directly from the source', () => {
    const schema = buildSchema(`
      type Query {
        add(x: Int, y: Int): Int
      }
    `);

    const root = {
      add: ({ x, y }) => x + y,
    };
    expect(graphqlSync(schema, '{ add(x: 34, y: 55) }', root)).to.deep.equal({
      data: { add: 89 },
    });
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
    const schema = buildSchema(`
      type Query {
        str: String
      }
    `);

    // String and Boolean are always included through introspection types
    expect(schema.getType('Int')).to.equal(undefined);
    expect(schema.getType('Float')).to.equal(undefined);
    expect(schema.getType('ID')).to.equal(undefined);
  });

  it('With directives', () => {
    const sdl = dedent`
      directive @foo(arg: Int) on FIELD

      type Query {
        str: String
      }
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
    const sdl = `
      type Query {
        str: String
      }
    `;
    const schema = buildSchema(sdl);
    expect(schema.getDirectives()).to.have.lengthOf(3);
    expect(schema.getDirective('skip')).to.equal(GraphQLSkipDirective);
    expect(schema.getDirective('include')).to.equal(GraphQLIncludeDirective);
    expect(schema.getDirective('deprecated')).to.equal(
      GraphQLDeprecatedDirective,
    );
  });

  it('Overriding directives excludes specified', () => {
    const sdl = `
      directive @skip on FIELD
      directive @include on FIELD
      directive @deprecated on FIELD_DEFINITION

      type Query {
        str: String
      }
    `;
    const schema = buildSchema(sdl);
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
    const sdl = `
      directive @foo(arg: Int) on FIELD

      type Query {
        str: String
      }
    `;
    const schema = buildSchema(sdl);
    expect(schema.getDirectives()).to.have.lengthOf(4);
    expect(schema.getDirective('skip')).to.not.equal(undefined);
    expect(schema.getDirective('include')).to.not.equal(undefined);
    expect(schema.getDirective('deprecated')).to.not.equal(undefined);
  });

  it('Type modifiers', () => {
    const sdl = dedent`
      type Query {
        nonNullStr: String!
        listOfStrs: [String]
        listOfNonNullStrs: [String!]
        nonNullListOfStrs: [String]!
        nonNullListOfNonNullStrs: [String!]!
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
      schema {
        query: TypeOne
      }

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

    const query = `
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

    const root = {
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

    expect(graphqlSync(schema, query, root)).to.deep.equal({
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

    const query = `
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

    const root = {
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

    expect(graphqlSync(schema, query, root)).to.deep.equal({
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
      type Concrete implements Iface {
        key: String
      }

      interface Iface {
        key: String
      }

      type Query {
        iface: Iface
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

    const restoredSchemaAST = {
      kind: Kind.DOCUMENT,
      definitions: [
        schema.astNode,
        query.astNode,
        testInput.astNode,
        testEnum.astNode,
        testUnion.astNode,
        testInterface.astNode,
        testType.astNode,
        testScalar.astNode,
        testDirective.astNode,
      ],
      loc: undefined,
    };
    expect(restoredSchemaAST).to.be.deep.equal(ast);

    const testField = query.getFields().testField;
    expect(printNode(testField.astNode)).to.equal(
      'testField(testArg: TestInput): TestUnion',
    );
    expect(printNode(testField.args[0].astNode)).to.equal('testArg: TestInput');
    expect(printNode(testInput.getFields().testInputField.astNode)).to.equal(
      'testInputField: TestEnum',
    );
    const testEnumValue = testEnum.getValue('TEST_VALUE');
    invariant(testEnumValue);
    expect(printNode(testEnumValue.astNode)).to.equal('TEST_VALUE');

    expect(
      printNode(testInterface.getFields().interfaceField.astNode),
    ).to.equal('interfaceField: String');
    expect(printNode(testType.getFields().interfaceField.astNode)).to.equal(
      'interfaceField: String',
    );
    expect(printNode(testDirective.args[0].astNode)).to.equal(
      'arg: TestScalar',
    );
  });

  it('Root operation types with custom names', () => {
    const schema = buildSchema(`
      schema {
        query: SomeQuery
        mutation: SomeMutation
        subscription: SomeSubscription
      }
      type SomeQuery { str: String }
      type SomeMutation { str: String }
      type SomeSubscription { str: String }
    `);

    expect(schema.getQueryType()).to.include({ name: 'SomeQuery' });
    expect(schema.getMutationType()).to.include({ name: 'SomeMutation' });
    expect(schema.getSubscriptionType()).to.include({
      name: 'SomeSubscription',
    });
  });

  it('Default root operation type names', () => {
    const schema = buildSchema(`
      type Query { str: String }
      type Mutation { str: String }
      type Subscription { str: String }
    `);

    expect(schema.getQueryType()).to.include({ name: 'Query' });
    expect(schema.getMutationType()).to.include({ name: 'Mutation' });
    expect(schema.getSubscriptionType()).to.include({ name: 'Subscription' });
  });

  it('can build invalid schema', () => {
    const schema = buildSchema(`
      # Invalid schema, because it is missing query root type
      type Mutation {
        str: String
      }
    `);
    const errors = validateSchema(schema);
    expect(errors).to.have.lengthOf.above(0);
  });

  it('Accepts legacy names', () => {
    const sdl = `
      type Query {
        __badName: String
      }
    `;
    const schema = buildSchema(sdl, { allowedLegacyNames: ['__badName'] });
    const errors = validateSchema(schema);
    expect(errors).to.have.lengthOf(0);
  });

  it('Rejects invalid SDL', () => {
    const sdl = `
      type Query {
        foo: String @unknown
      }
    `;
    expect(() => buildSchema(sdl)).to.throw('Unknown directive "unknown".');
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
});
