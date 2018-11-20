/**
 * Copyright (c) 2015-present, Facebook, Inc.
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
  assertObjectType,
  assertInputObjectType,
  assertEnumType,
  assertUnionType,
  assertInterfaceType,
  assertScalarType,
  graphqlSync,
  validateSchema,
  GraphQLSkipDirective,
  GraphQLIncludeDirective,
  GraphQLDeprecatedDirective,
} from '../../';

/**
 * This function does a full cycle of going from a
 * string with the contents of the DSL, parsed
 * in a schema AST, materializing that schema AST
 * into an in-memory GraphQLSchema, and then finally
 * printing that GraphQL into the DSL
 */
function cycleOutput(body, options = {}) {
  const commentDescriptions = options.commentDescriptions || false;
  const ast = parse(body);
  const schema = buildASTSchema(ast, options);
  return printSchema(schema, { commentDescriptions });
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

  it('Simple type', () => {
    const body = dedent`
      type Query {
        str: String
        int: Int
        float: Float
        id: ID
        bool: Boolean
      }
    `;

    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('With directives', () => {
    const body = dedent`
      directive @foo(arg: Int) on FIELD

      type Query {
        str: String
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Supports descriptions', () => {
    const body = dedent`
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
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Supports option for comment descriptions', () => {
    const body = dedent`
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
    const output = cycleOutput(body, { commentDescriptions: true });
    expect(output).to.equal(body);
  });

  it('Maintains @skip & @include', () => {
    const body = `
      type Query {
        str: String
      }
    `;
    const schema = buildASTSchema(parse(body));
    expect(schema.getDirectives().length).to.equal(3);
    expect(schema.getDirective('skip')).to.equal(GraphQLSkipDirective);
    expect(schema.getDirective('include')).to.equal(GraphQLIncludeDirective);
    expect(schema.getDirective('deprecated')).to.equal(
      GraphQLDeprecatedDirective,
    );
  });

  it('Overriding directives excludes specified', () => {
    const body = `
      directive @skip on FIELD
      directive @include on FIELD
      directive @deprecated on FIELD_DEFINITION

      type Query {
        str: String
      }
    `;
    const schema = buildASTSchema(parse(body));
    expect(schema.getDirectives().length).to.equal(3);
    expect(schema.getDirective('skip')).to.not.equal(GraphQLSkipDirective);
    expect(schema.getDirective('include')).to.not.equal(
      GraphQLIncludeDirective,
    );
    expect(schema.getDirective('deprecated')).to.not.equal(
      GraphQLDeprecatedDirective,
    );
  });

  it('Adding directives maintains @skip & @include', () => {
    const body = `
      directive @foo(arg: Int) on FIELD

      type Query {
        str: String
      }
    `;
    const schema = buildASTSchema(parse(body));
    expect(schema.getDirectives().length).to.equal(4);
    expect(schema.getDirective('skip')).to.not.equal(undefined);
    expect(schema.getDirective('include')).to.not.equal(undefined);
    expect(schema.getDirective('deprecated')).to.not.equal(undefined);
  });

  it('Type modifiers', () => {
    const body = dedent`
      type Query {
        nonNullStr: String!
        listOfStrs: [String]
        listOfNonNullStrs: [String!]
        nonNullListOfStrs: [String]!
        nonNullListOfNonNullStrs: [String!]!
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Recursive type', () => {
    const body = dedent`
      type Query {
        str: String
        recurse: Query
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Two types circular', () => {
    const body = dedent`
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
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Single argument field', () => {
    const body = dedent`
      type Query {
        str(int: Int): String
        floatToStr(float: Float): String
        idToStr(id: ID): String
        booleanToStr(bool: Boolean): String
        strToStr(bool: String): String
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Simple type with multiple arguments', () => {
    const body = dedent`
      type Query {
        str(int: Int, bool: Boolean): String
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Simple type with interface', () => {
    const body = dedent`
      type Query implements WorldInterface {
        str: String
      }

      interface WorldInterface {
        str: String
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Simple output enum', () => {
    const body = dedent`
      enum Hello {
        WORLD
      }

      type Query {
        hello: Hello
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Simple input enum', () => {
    const body = dedent`
      enum Hello {
        WORLD
      }

      type Query {
        str(hello: Hello): String
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Multiple value enum', () => {
    const body = dedent`
      enum Hello {
        WO
        RLD
      }

      type Query {
        hello: Hello
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Simple Union', () => {
    const body = dedent`
      union Hello = World

      type Query {
        hello: Hello
      }

      type World {
        str: String
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Multiple Union', () => {
    const body = dedent`
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
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Can build recursive Union', () => {
    const schema = buildSchema(`
      union Hello = Hello

      type Query {
        hello: Hello
      }
    `);
    const errors = validateSchema(schema);
    expect(errors.length).to.be.above(0);
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
    const body = dedent`
      scalar CustomScalar

      type Query {
        customScalar: CustomScalar
      }
    `;

    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Input Object', () => {
    const body = dedent`
      input Input {
        int: Int
      }

      type Query {
        field(in: Input): String
      }
    `;

    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Simple argument field with default', () => {
    const body = dedent`
      type Query {
        str(int: Int = 2): String
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Custom scalar argument field with default', () => {
    const body = dedent`
      scalar CustomScalar

      type Query {
        str(int: CustomScalar = 2): String
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Simple type with mutation', () => {
    const body = dedent`
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
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Simple type with subscription', () => {
    const body = dedent`
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
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Unreferenced type implementing referenced interface', () => {
    const body = dedent`
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
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Unreferenced type implementing referenced union', () => {
    const body = dedent`
      type Concrete {
        key: String
      }

      type Query {
        union: Union
      }

      union Union = Concrete
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Supports @deprecated', () => {
    const body = dedent`
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
    const output = cycleOutput(body);
    expect(output).to.equal(body);

    const ast = parse(body);
    const schema = buildASTSchema(ast);

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
    const schemaAST = parse(dedent`
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
    `);

    const schema = buildASTSchema(schemaAST);
    const query = assertObjectType(schema.getType('Query'));
    const testInput = assertInputObjectType(schema.getType('TestInput'));
    const testEnum = assertEnumType(schema.getType('TestEnum'));
    const testUnion = assertUnionType(schema.getType('TestUnion'));
    const testInterface = assertInterfaceType(schema.getType('TestInterface'));
    const testType = assertObjectType(schema.getType('TestType'));
    const testScalar = assertScalarType(schema.getType('TestScalar'));
    const testDirective = schema.getDirective('test');
    invariant(testDirective);

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
    };
    expect(print(restoredSchemaAST)).to.be.equal(print(schemaAST));

    const testField = query.getFields().testField;
    expect(print(testField.astNode)).to.equal(
      'testField(testArg: TestInput): TestUnion',
    );
    expect(print(testField.args[0].astNode)).to.equal('testArg: TestInput');
    expect(print(testInput.getFields().testInputField.astNode)).to.equal(
      'testInputField: TestEnum',
    );
    const testEnumValue = testEnum.getValue('TEST_VALUE');
    invariant(testEnumValue);
    expect(print(testEnumValue.astNode)).to.equal('TEST_VALUE');

    expect(print(testInterface.getFields().interfaceField.astNode)).to.equal(
      'interfaceField: String',
    );
    expect(print(testType.getFields().interfaceField.astNode)).to.equal(
      'interfaceField: String',
    );
    expect(print(testDirective.args[0].astNode)).to.equal('arg: TestScalar');
  });

  it('Root operation types with custom names', () => {
    const schema = buildSchema(dedent`
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
    const schema = buildSchema(dedent`
      type Query { str: String }
      type Mutation { str: String }
      type Subscription { str: String }
    `);

    expect(schema.getQueryType()).to.include({ name: 'Query' });
    expect(schema.getMutationType()).to.include({ name: 'Mutation' });
    expect(schema.getSubscriptionType()).to.include({ name: 'Subscription' });
  });

  it('can build invalid schema', () => {
    const schema = buildSchema(dedent`
      # Invalid schema, because it is missing query root type
      type Mutation {
        str: String
      }
    `);
    const errors = validateSchema(schema);
    expect(errors.length).to.be.above(0);
  });

  it('Accepts legacy names', () => {
    const doc = parse(dedent`
      type Query {
        __badName: String
      }
    `);
    const schema = buildASTSchema(doc, { allowedLegacyNames: ['__badName'] });
    const errors = validateSchema(schema);
    expect(errors.length).to.equal(0);
  });

  it('Rejects invalid SDL', () => {
    const doc = parse(`
      type Query {
        foo: String @unknown
      }
    `);
    expect(() => buildASTSchema(doc)).to.throw('Unknown directive "unknown".');
  });

  it('Allows to disable SDL validation', () => {
    const body = `
      type Query {
        foo: String @unknown
      }
    `;
    buildSchema(body, { assumeValid: true });
    buildSchema(body, { assumeValidSDL: true });
  });
});

describe('Failures', () => {
  it('Allows only a single query type', () => {
    const body = dedent`
      schema {
        query: Hello
        query: Yellow
      }

      type Hello {
        bar: String
      }

      type Yellow {
        isColor: Boolean
      }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc)).to.throw(
      'Must provide only one query type in schema.',
    );
  });

  it('Allows only a single mutation type', () => {
    const body = dedent`
      schema {
        query: Hello
        mutation: Hello
        mutation: Yellow
      }

      type Hello {
        bar: String
      }

      type Yellow {
        isColor: Boolean
      }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc)).to.throw(
      'Must provide only one mutation type in schema.',
    );
  });

  it('Allows only a single subscription type', () => {
    const body = dedent`
      schema {
        query: Hello
        subscription: Hello
        subscription: Yellow
      }

      type Hello {
        bar: String
      }

      type Yellow {
        isColor: Boolean
      }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc)).to.throw(
      'Must provide only one subscription type in schema.',
    );
  });

  it('Unknown type referenced', () => {
    const body = dedent`
      schema {
        query: Hello
      }

      type Hello {
        bar: Bar
      }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc)).to.throw(
      'Type "Bar" not found in document.',
    );
  });

  it('Unknown type in interface list', () => {
    const body = dedent`
      type Query implements Bar {
        field: String
      }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc)).to.throw(
      'Type "Bar" not found in document.',
    );
  });

  it('Unknown type in union list', () => {
    const body = dedent`
      union TestUnion = Bar
      type Query { testUnion: TestUnion }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc)).to.throw(
      'Type "Bar" not found in document.',
    );
  });

  it('Unknown query type', () => {
    const body = dedent`
      schema {
        query: Wat
      }

      type Hello {
        str: String
      }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc)).to.throw(
      'Specified query type "Wat" not found in document.',
    );
  });

  it('Unknown mutation type', () => {
    const body = dedent`
      schema {
        query: Hello
        mutation: Wat
      }

      type Hello {
        str: String
      }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc)).to.throw(
      'Specified mutation type "Wat" not found in document.',
    );
  });

  it('Unknown subscription type', () => {
    const body = dedent`
      schema {
        query: Hello
        mutation: Wat
        subscription: Awesome
      }

      type Hello {
        str: String
      }

      type Wat {
        str: String
      }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc)).to.throw(
      'Specified subscription type "Awesome" not found in document.',
    );
  });

  it('Does not consider directive names', () => {
    const body = dedent`
      schema {
        query: Foo
      }

      directive @Foo on QUERY
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc)).to.throw(
      'Specified query type "Foo" not found in document.',
    );
  });

  it('Does not consider operation names', () => {
    const body = dedent`
      schema {
        query: Foo
      }

      query Foo { field }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc)).to.throw(
      'Specified query type "Foo" not found in document.',
    );
  });

  it('Does not consider fragment names', () => {
    const body = dedent`
      schema {
        query: Foo
      }

      fragment Foo on Type { field }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc)).to.throw(
      'Specified query type "Foo" not found in document.',
    );
  });

  it('Forbids duplicate type definitions', () => {
    const body = dedent`
      schema {
        query: Repeated
      }

      type Repeated {
        id: Int
      }

      type Repeated {
        id: String
      }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc)).to.throw(
      'Type "Repeated" was defined more than once.',
    );
  });
});
