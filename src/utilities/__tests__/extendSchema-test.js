import { expect } from 'chai';
import { describe, it } from 'mocha';

import dedent from '../../__testUtils__/dedent';

import invariant from '../../jsutils/invariant';

import type { ASTNode } from '../../language/ast';
import { Kind } from '../../language/kinds';
import { parse } from '../../language/parser';
import { print } from '../../language/printer';

import { graphqlSync } from '../../graphql';

import type { GraphQLNamedType } from '../../type/definition';
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
} from '../../type/definition';

import { concatAST } from '../concatAST';
import { printSchema } from '../printSchema';
import { extendSchema } from '../extendSchema';
import { buildSchema } from '../buildASTSchema';

function printExtensionNodes(obj: ?GraphQLNamedType | GraphQLSchema): string {
  invariant(obj?.extensionASTNodes != null);
  return print({
    kind: Kind.DOCUMENT,
    definitions: obj.extensionASTNodes,
  });
}

function printSchemaChanges(
  schema: GraphQLSchema,
  extendedSchema: GraphQLSchema,
): string {
  const schemaDefinitions = parse(printSchema(schema)).definitions.map(print);
  const ast = parse(printSchema(extendedSchema));
  return print({
    kind: Kind.DOCUMENT,
    definitions: ast.definitions.filter(
      (node) => !schemaDefinitions.includes(print(node)),
    ),
  });
}

function printASTNode(obj: ?{ +astNode: ?ASTNode, ... }): string {
  invariant(obj?.astNode != null);
  return print(obj.astNode);
}

describe('extendSchema', () => {
  it('returns the original schema when there are no type definitions', () => {
    const schema = buildSchema('type Query');
    const extendedSchema = extendSchema(schema, parse('{ field }'));
    expect(extendedSchema).to.equal(schema);
  });

  it('can be used for limited execution', () => {
    const schema = buildSchema('type Query');
    const extendAST = parse(`
      extend type Query {
        newField: String
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    const result = graphqlSync({
      schema: extendedSchema,
      source: '{ newField }',
      rootValue: { newField: 123 },
    });
    expect(result).to.deep.equal({
      data: { newField: '123' },
    });
  });

  it('extends objects by adding new fields', () => {
    const schema = buildSchema(`
      type Query {
        someObject: SomeObject
      }

      type SomeObject implements AnotherInterface & SomeInterface {
        self: SomeObject
        tree: [SomeObject]!
        """Old field description."""
        oldField: String
      }

      interface SomeInterface {
        self: SomeInterface
      }

      interface AnotherInterface {
        self: SomeObject
      }
    `);
    const extensionSDL = dedent`
      extend type SomeObject {
        """New field description."""
        newField(arg: Boolean): String
      }
    `;
    const extendedSchema = extendSchema(schema, parse(extensionSDL));

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expect(printSchemaChanges(schema, extendedSchema)).to.equal(dedent`
      type SomeObject implements AnotherInterface & SomeInterface {
        self: SomeObject
        tree: [SomeObject]!
        """Old field description."""
        oldField: String
        """New field description."""
        newField(arg: Boolean): String
      }
    `);
  });

  it('can describe the extended fields with legacy comments', () => {
    const schema = buildSchema('type Query');
    const extendAST = parse(`
      extend type Query {
        # New field description.
        newField: String
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST, {
      commentDescriptions: true,
    });

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expect(printSchemaChanges(schema, extendedSchema)).to.equal(dedent`
      type Query {
        """New field description."""
        newField: String
      }
    `);
  });

  it('describes extended fields with strings when present', () => {
    const schema = buildSchema('type Query');
    const extendAST = parse(`
      extend type Query {
        # New field description.
        "Actually use this description."
        newField: String
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST, {
      commentDescriptions: true,
    });

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expect(printSchemaChanges(schema, extendedSchema)).to.equal(dedent`
      type Query {
        """Actually use this description."""
        newField: String
      }
    `);
  });

  it('ignores comment description on extended fields if location is not provided', () => {
    const schema = buildSchema('type Query');
    const extendSDL = `
      extend type Query {
        # New field description.
        newField: String
      }
    `;
    const extendAST = parse(extendSDL, { noLocation: true });
    const extendedSchema = extendSchema(schema, extendAST, {
      commentDescriptions: true,
    });

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expect(printSchemaChanges(schema, extendedSchema)).to.equal(dedent`
      type Query {
        newField: String
      }
    `);
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

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
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

    expect(validateSchema(extendedTwiceSchema)).to.deep.equal([]);
    expect(extendedTwiceSchema.getType('Int')).to.equal(GraphQLInt);
    expect(extendedTwiceSchema.getType('Float')).to.equal(GraphQLFloat);
    expect(extendedTwiceSchema.getType('String')).to.equal(GraphQLString);
    expect(extendedTwiceSchema.getType('Boolean')).to.equal(GraphQLBoolean);
    expect(extendedTwiceSchema.getType('ID')).to.equal(GraphQLID);
  });

  it('extends enums by adding new values', () => {
    const schema = buildSchema(`
      type Query {
        someEnum(arg: SomeEnum): SomeEnum
      }

      directive @foo(arg: SomeEnum) on SCHEMA

      enum SomeEnum {
        """Old value description."""
        OLD_VALUE
      }
    `);
    const extendAST = parse(`
      extend enum SomeEnum {
        """New value description."""
        NEW_VALUE
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expect(printSchemaChanges(schema, extendedSchema)).to.equal(dedent`
      enum SomeEnum {
        """Old value description."""
        OLD_VALUE
        """New value description."""
        NEW_VALUE
      }
    `);
  });

  it('extends unions by adding new types', () => {
    const schema = buildSchema(`
      type Query {
        someUnion: SomeUnion
      }

      union SomeUnion = Foo | Biz

      type Foo { foo: String }
      type Biz { biz: String }
      type Bar { bar: String }
    `);
    const extendAST = parse(`
      extend union SomeUnion = Bar
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expect(printSchemaChanges(schema, extendedSchema)).to.equal(dedent`
      union SomeUnion = Foo | Biz | Bar
    `);
  });

  it('allows extension of union by adding itself', () => {
    const schema = buildSchema(`
      union SomeUnion
    `);
    const extendAST = parse(`
      extend union SomeUnion = SomeUnion
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.have.lengthOf.above(0);
    expect(printSchemaChanges(schema, extendedSchema)).to.equal(dedent`
      union SomeUnion = SomeUnion
    `);
  });

  it('extends inputs by adding new fields', () => {
    const schema = buildSchema(`
      type Query {
        someInput(arg: SomeInput): String
      }

      directive @foo(arg: SomeInput) on SCHEMA

      input SomeInput {
        """Old field description."""
        oldField: String
      }
    `);
    const extendAST = parse(`
      extend input SomeInput {
        """New field description."""
        newField: String
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expect(printSchemaChanges(schema, extendedSchema)).to.equal(dedent`
      input SomeInput {
        """Old field description."""
        oldField: String
        """New field description."""
        newField: String
      }
    `);
  });

  it('extends scalars by adding new directives', () => {
    const schema = buildSchema(`
      type Query {
        someScalar(arg: SomeScalar): SomeScalar
      }

      directive @foo(arg: SomeScalar) on SCALAR

      input FooInput {
        foo: SomeScalar
      }

      scalar SomeScalar
    `);
    const extensionSDL = dedent`
      extend scalar SomeScalar @foo
    `;
    const extendedSchema = extendSchema(schema, parse(extensionSDL));
    const someScalar = extendedSchema.getType('SomeScalar');

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expect(printExtensionNodes(someScalar)).to.deep.equal(extensionSDL);
  });

  it('extends scalars by adding specifiedBy directive', () => {
    const schema = buildSchema(`
      type Query {
        foo: Foo
      }

      scalar Foo

      directive @foo on SCALAR
    `);
    const extensionSDL = dedent`
      extend scalar Foo @foo

      extend scalar Foo @specifiedBy(url: "https://example.com/foo_spec")
    `;

    const extendedSchema = extendSchema(schema, parse(extensionSDL));
    const foo = assertScalarType(extendedSchema.getType('Foo'));

    expect(foo.specifiedByUrl).to.equal('https://example.com/foo_spec');

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expect(printExtensionNodes(foo)).to.deep.equal(extensionSDL);
  });

  it('correctly assign AST nodes to new and extended types', () => {
    const schema = buildSchema(`
      type Query

      scalar SomeScalar
      enum SomeEnum
      union SomeUnion
      input SomeInput
      type SomeObject
      interface SomeInterface

      directive @foo on SCALAR
    `);
    const firstExtensionAST = parse(`
      extend type Query {
        newField(testArg: TestInput): TestEnum
      }

      extend scalar SomeScalar @foo

      extend enum SomeEnum {
        NEW_VALUE
      }

      extend union SomeUnion = SomeObject

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
    const extendedSchema = extendSchema(schema, firstExtensionAST);

    const secondExtensionAST = parse(`
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
    const extendedTwiceSchema = extendSchema(
      extendedSchema,
      secondExtensionAST,
    );

    const extendedInOneGoSchema = extendSchema(
      schema,
      concatAST([firstExtensionAST, secondExtensionAST]),
    );
    expect(printSchema(extendedInOneGoSchema)).to.equal(
      printSchema(extendedTwiceSchema),
    );

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

    invariant(query.extensionASTNodes);
    invariant(someScalar.extensionASTNodes);
    invariant(someEnum.extensionASTNodes);
    invariant(someUnion.extensionASTNodes);
    invariant(someInput.extensionASTNodes);
    invariant(someInterface.extensionASTNodes);

    expect([
      testInput.astNode,
      testEnum.astNode,
      testUnion.astNode,
      testInterface.astNode,
      testType.astNode,
      testDirective.astNode,
      ...query.extensionASTNodes,
      ...someScalar.extensionASTNodes,
      ...someEnum.extensionASTNodes,
      ...someUnion.extensionASTNodes,
      ...someInput.extensionASTNodes,
      ...someInterface.extensionASTNodes,
    ]).to.have.members([
      ...firstExtensionAST.definitions,
      ...secondExtensionAST.definitions,
    ]);

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
    const schema = new GraphQLSchema({});
    const extendAST = parse(`
      type SomeObject {
        deprecatedField: String @deprecated(reason: "not used anymore")
      }

      enum SomeEnum {
        DEPRECATED_VALUE @deprecated(reason: "do not use")
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    const someType = assertObjectType(extendedSchema.getType('SomeObject'));
    expect(someType.getFields().deprecatedField).to.include({
      isDeprecated: true,
      deprecationReason: 'not used anymore',
    });

    const someEnum = assertEnumType(extendedSchema.getType('SomeEnum'));
    expect(someEnum.getValue('DEPRECATED_VALUE')).to.include({
      isDeprecated: true,
      deprecationReason: 'do not use',
    });
  });

  it('extends objects with deprecated fields', () => {
    const schema = buildSchema('type SomeObject');
    const extendAST = parse(`
      extend type SomeObject {
        deprecatedField: String @deprecated(reason: "not used anymore")
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    const someType = assertObjectType(extendedSchema.getType('SomeObject'));
    expect(someType.getFields().deprecatedField).to.include({
      isDeprecated: true,
      deprecationReason: 'not used anymore',
    });
  });

  it('extends enums with deprecated values', () => {
    const schema = buildSchema('enum SomeEnum');
    const extendAST = parse(`
      extend enum SomeEnum {
        DEPRECATED_VALUE @deprecated(reason: "do not use")
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    const someEnum = assertEnumType(extendedSchema.getType('SomeEnum'));
    expect(someEnum.getValue('DEPRECATED_VALUE')).to.include({
      isDeprecated: true,
      deprecationReason: 'do not use',
    });
  });

  it('adds new unused types', () => {
    const schema = buildSchema(`
      type Query {
        dummy: String
      }
    `);
    const extensionSDL = dedent`
      type DummyUnionMember {
        someField: String
      }

      enum UnusedEnum {
        SOME_VALUE
      }

      input UnusedInput {
        someField: String
      }

      interface UnusedInterface {
        someField: String
      }

      type UnusedObject {
        someField: String
      }

      union UnusedUnion = DummyUnionMember
    `;
    const extendedSchema = extendSchema(schema, parse(extensionSDL));

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expect(printSchemaChanges(schema, extendedSchema)).to.equal(extensionSDL);
  });

  it('extends objects by adding new fields with arguments', () => {
    const schema = buildSchema(`
      type SomeObject

      type Query {
        someObject: SomeObject
      }
    `);
    const extendAST = parse(`
      input NewInputObj {
        field1: Int
        field2: [Float]
        field3: String!
      }

      extend type SomeObject {
        newField(arg1: String, arg2: NewInputObj!): String
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expect(printSchemaChanges(schema, extendedSchema)).to.equal(dedent`
      type SomeObject {
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
    const schema = buildSchema(`
      type Query {
        someObject: SomeObject
      }

      type SomeObject
      enum SomeEnum { VALUE }
    `);
    const extendAST = parse(`
      extend type SomeObject {
        newField(arg1: SomeEnum!): SomeEnum
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expect(printSchemaChanges(schema, extendedSchema)).to.equal(dedent`
      type SomeObject {
        newField(arg1: SomeEnum!): SomeEnum
      }
    `);
  });

  it('extends objects by adding implemented interfaces', () => {
    const schema = buildSchema(`
      type Query {
        someObject: SomeObject
      }

      type SomeObject {
        foo: String
      }

      interface SomeInterface {
        foo: String
      }
    `);
    const extendAST = parse(`
      extend type SomeObject implements SomeInterface
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expect(printSchemaChanges(schema, extendedSchema)).to.equal(dedent`
      type SomeObject implements SomeInterface {
        foo: String
      }
    `);
  });

  it('extends objects by including new types', () => {
    const schema = buildSchema(`
      type Query {
        someObject: SomeObject
      }

      type SomeObject {
        oldField: String
      }
    `);
    const newTypesSDL = dedent`
      enum NewEnum {
        VALUE
      }

      interface NewInterface {
        baz: String
      }

      type NewObject implements NewInterface {
        baz: String
      }

      scalar NewScalar

      union NewUnion = NewObject`;
    const extendAST = parse(`
      ${newTypesSDL}
      extend type SomeObject {
        newObject: NewObject
        newInterface: NewInterface
        newUnion: NewUnion
        newScalar: NewScalar
        newEnum: NewEnum
        newTree: [SomeObject]!
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expect(printSchemaChanges(schema, extendedSchema)).to.equal(dedent`
      type SomeObject {
        oldField: String
        newObject: NewObject
        newInterface: NewInterface
        newUnion: NewUnion
        newScalar: NewScalar
        newEnum: NewEnum
        newTree: [SomeObject]!
      }

      ${newTypesSDL}
    `);
  });

  it('extends objects by adding implemented new interfaces', () => {
    const schema = buildSchema(`
      type Query {
        someObject: SomeObject
      }

      type SomeObject implements OldInterface {
        oldField: String
      }

      interface OldInterface {
        oldField: String
      }
    `);
    const extendAST = parse(`
      extend type SomeObject implements NewInterface {
        newField: String
      }

      interface NewInterface {
        newField: String
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expect(printSchemaChanges(schema, extendedSchema)).to.equal(dedent`
      type SomeObject implements OldInterface & NewInterface {
        oldField: String
        newField: String
      }

      interface NewInterface {
        newField: String
      }
    `);
  });

  it('extends different types multiple times', () => {
    const schema = buildSchema(`
      type Query {
        someScalar: SomeScalar
        someObject(someInput: SomeInput): SomeObject
        someInterface: SomeInterface
        someEnum: SomeEnum
        someUnion: SomeUnion
      }

      scalar SomeScalar

      type SomeObject implements SomeInterface {
        oldField: String
      }

      interface SomeInterface {
        oldField: String
      }

      enum SomeEnum {
        OLD_VALUE
      }

      union SomeUnion = SomeObject

      input SomeInput {
        oldField: String
      }
    `);
    const newTypesSDL = dedent`
      scalar NewScalar

      scalar AnotherNewScalar

      type NewObject {
        foo: String
      }

      type AnotherNewObject {
        foo: String
      }

      interface NewInterface {
        newField: String
      }

      interface AnotherNewInterface {
        anotherNewField: String
      }`;
    const schemaWithNewTypes = extendSchema(schema, parse(newTypesSDL));
    expect(printSchemaChanges(schema, schemaWithNewTypes)).to.equal(
      newTypesSDL + '\n',
    );

    const extendAST = parse(`
      extend scalar SomeScalar @specifiedBy(url: "http://example.com/foo_spec")

      extend type SomeObject implements NewInterface {
        newField: String
      }

      extend type SomeObject implements AnotherNewInterface {
        anotherNewField: String
      }

      extend enum SomeEnum {
        NEW_VALUE
      }

      extend enum SomeEnum {
        ANOTHER_NEW_VALUE
      }

      extend union SomeUnion = NewObject

      extend union SomeUnion = AnotherNewObject

      extend input SomeInput {
        newField: String
      }

      extend input SomeInput {
        anotherNewField: String
      }
    `);
    const extendedSchema = extendSchema(schemaWithNewTypes, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expect(printSchemaChanges(schema, extendedSchema)).to.equal(dedent`
      scalar SomeScalar @specifiedBy(url: "http://example.com/foo_spec")

      type SomeObject implements SomeInterface & NewInterface & AnotherNewInterface {
        oldField: String
        newField: String
        anotherNewField: String
      }

      enum SomeEnum {
        OLD_VALUE
        NEW_VALUE
        ANOTHER_NEW_VALUE
      }

      union SomeUnion = SomeObject | NewObject | AnotherNewObject

      input SomeInput {
        oldField: String
        newField: String
        anotherNewField: String
      }

      ${newTypesSDL}
    `);
  });

  it('extends interfaces by adding new fields', () => {
    const schema = buildSchema(`
      interface SomeInterface {
        oldField: String
      }

      interface AnotherInterface implements SomeInterface {
        oldField: String
      }

      type SomeObject implements SomeInterface & AnotherInterface {
        oldField: String
      }

      type Query {
        someInterface: SomeInterface
      }
    `);
    const extendAST = parse(`
      extend interface SomeInterface {
        newField: String
      }

      extend interface AnotherInterface {
        newField: String
      }

      extend type SomeObject {
        newField: String
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expect(printSchemaChanges(schema, extendedSchema)).to.equal(dedent`
      interface SomeInterface {
        oldField: String
        newField: String
      }

      interface AnotherInterface implements SomeInterface {
        oldField: String
        newField: String
      }

      type SomeObject implements SomeInterface & AnotherInterface {
        oldField: String
        newField: String
      }
    `);
  });

  it('extends interfaces by adding new implemented interfaces', () => {
    const schema = buildSchema(`
      interface SomeInterface {
        oldField: String
      }

      interface AnotherInterface implements SomeInterface {
        oldField: String
      }

      type SomeObject implements SomeInterface & AnotherInterface {
        oldField: String
      }

      type Query {
        someInterface: SomeInterface
      }
    `);
    const extendAST = parse(`
      interface NewInterface {
        newField: String
      }

      extend interface AnotherInterface implements NewInterface {
        newField: String
      }

      extend type SomeObject implements NewInterface {
        newField: String
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expect(printSchemaChanges(schema, extendedSchema)).to.equal(dedent`
      interface AnotherInterface implements SomeInterface & NewInterface {
        oldField: String
        newField: String
      }

      type SomeObject implements SomeInterface & AnotherInterface & NewInterface {
        oldField: String
        newField: String
      }

      interface NewInterface {
        newField: String
      }
    `);
  });

  it('allows extension of interface with missing Object fields', () => {
    const schema = buildSchema(`
      type Query {
        someInterface: SomeInterface
      }

      type SomeObject implements SomeInterface {
        oldField: SomeInterface
      }

      interface SomeInterface {
        oldField: SomeInterface
      }
    `);
    const extendAST = parse(`
      extend interface SomeInterface {
        newField: String
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.have.lengthOf.above(0);
    expect(printSchemaChanges(schema, extendedSchema)).to.equal(dedent`
      interface SomeInterface {
        oldField: SomeInterface
        newField: String
      }
    `);
  });

  it('extends interfaces multiple times', () => {
    const schema = buildSchema(`
      type Query {
        someInterface: SomeInterface
      }

      interface SomeInterface {
        some: SomeInterface
      }
    `);

    const extendAST = parse(`
      extend interface SomeInterface {
        newFieldA: Int
      }

      extend interface SomeInterface {
        newFieldB(test: Boolean): String
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expect(printSchemaChanges(schema, extendedSchema)).to.equal(dedent`
      interface SomeInterface {
        some: SomeInterface
        newFieldA: Int
        newFieldB(test: Boolean): String
      }
    `);
  });

  it('may extend mutations and subscriptions', () => {
    const mutationSchema = buildSchema(`
      type Query {
        queryField: String
      }

      type Mutation {
        mutationField: String
      }

      type Subscription {
        subscriptionField: String
      }
    `);
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
      type Query {
        queryField: String
        newQueryField: Int
      }

      type Mutation {
        mutationField: String
        newMutationField: Int
      }

      type Subscription {
        subscriptionField: String
        newSubscriptionField: Int
      }
    `);
  });

  it('may extend directives with new directive', () => {
    const schema = buildSchema(`
      type Query {
        foo: String
      }
    `);
    const extensionSDL = dedent`
      """New directive."""
      directive @new(enable: Boolean!, tag: String) repeatable on QUERY | FIELD
    `;
    const extendedSchema = extendSchema(schema, parse(extensionSDL));

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expect(printSchemaChanges(schema, extendedSchema)).to.equal(extensionSDL);
  });

  it('sets correct description using legacy comments', () => {
    const schema = buildSchema(`
      type Query {
        foo: String
      }
    `);
    const extendAST = parse(`
      # new directive
      directive @new on QUERY
    `);
    const extendedSchema = extendSchema(schema, extendAST, {
      commentDescriptions: true,
    });

    const newDirective = extendedSchema.getDirective('new');
    expect(newDirective).to.include({ description: 'new directive' });
  });

  it('Rejects invalid SDL', () => {
    const schema = new GraphQLSchema({});
    const extendAST = parse('extend schema @unknown');

    expect(() => extendSchema(schema, extendAST)).to.throw(
      'Unknown directive "@unknown".',
    );
  });

  it('Allows to disable SDL validation', () => {
    const schema = new GraphQLSchema({});
    const extendAST = parse('extend schema @unknown');

    extendSchema(schema, extendAST, { assumeValid: true });
    extendSchema(schema, extendAST, { assumeValidSDL: true });
  });

  it('Throws on unknown types', () => {
    const schema = new GraphQLSchema({});
    const ast = parse(`
      type Query {
        unknown: UnknownType
      }
    `);
    expect(() => extendSchema(schema, ast, { assumeValidSDL: true })).to.throw(
      'Unknown type: "UnknownType".',
    );
  });

  it('Rejects invalid AST', () => {
    const schema = new GraphQLSchema({});

    // $FlowExpectedError[incompatible-call]
    expect(() => extendSchema(schema, null)).to.throw(
      'Must provide valid Document AST',
    );

    // $FlowExpectedError[prop-missing]
    expect(() => extendSchema(schema, {})).to.throw(
      'Must provide valid Document AST',
    );
  });

  it('does not allow replacing a default directive', () => {
    const schema = new GraphQLSchema({});
    const extendAST = parse(`
      directive @include(if: Boolean!) on FIELD | FRAGMENT_SPREAD
    `);

    expect(() => extendSchema(schema, extendAST)).to.throw(
      'Directive "@include" already exists in the schema. It cannot be redefined.',
    );
  });

  it('does not allow replacing an existing enum value', () => {
    const schema = buildSchema(`
      enum SomeEnum {
        ONE
      }
    `);
    const extendAST = parse(`
      extend enum SomeEnum {
        ONE
      }
    `);

    expect(() => extendSchema(schema, extendAST)).to.throw(
      'Enum value "SomeEnum.ONE" already exists in the schema. It cannot also be defined in this type extension.',
    );
  });

  describe('can add additional root operation types', () => {
    it('does not automatically include common root type names', () => {
      const schema = new GraphQLSchema({});
      const extendedSchema = extendSchema(schema, parse('type Mutation'));

      expect(extendedSchema.getType('Mutation')).to.not.equal(undefined);
      expect(extendedSchema.getMutationType()).to.equal(undefined);
    });

    it('adds schema definition missing in the original schema', () => {
      const schema = buildSchema(`
        directive @foo on SCHEMA
        type Foo
      `);
      expect(schema.getQueryType()).to.equal(undefined);

      const extensionSDL = dedent`
        schema @foo {
          query: Foo
        }
      `;
      const extendedSchema = extendSchema(schema, parse(extensionSDL));

      const queryType = extendedSchema.getQueryType();
      expect(queryType).to.include({ name: 'Foo' });
      expect(printASTNode(extendedSchema) + '\n').to.equal(extensionSDL);
    });

    it('adds new root types via schema extension', () => {
      const schema = buildSchema(`
        type Query
        type MutationRoot
      `);
      const extensionSDL = dedent`
        extend schema {
          mutation: MutationRoot
        }
      `;
      const extendedSchema = extendSchema(schema, parse(extensionSDL));

      const mutationType = extendedSchema.getMutationType();
      expect(mutationType).to.include({ name: 'MutationRoot' });
      expect(printExtensionNodes(extendedSchema)).to.equal(extensionSDL);
    });

    it('adds directive via schema extension', () => {
      const schema = buildSchema(`
        type Query

        directive @foo on SCHEMA
      `);
      const extensionSDL = dedent`
        extend schema @foo
      `;
      const extendedSchema = extendSchema(schema, parse(extensionSDL));

      expect(printExtensionNodes(extendedSchema)).to.equal(extensionSDL);
    });

    it('adds multiple new root types via schema extension', () => {
      const schema = buildSchema('type Query');
      const extendAST = parse(`
        extend schema {
          mutation: Mutation
          subscription: Subscription
        }

        type Mutation
        type Subscription
      `);
      const extendedSchema = extendSchema(schema, extendAST);

      const mutationType = extendedSchema.getMutationType();
      expect(mutationType).to.include({ name: 'Mutation' });

      const subscriptionType = extendedSchema.getSubscriptionType();
      expect(subscriptionType).to.include({ name: 'Subscription' });
    });

    it('applies multiple schema extensions', () => {
      const schema = buildSchema('type Query');
      const extendAST = parse(`
        extend schema {
          mutation: Mutation
        }
        type Mutation

        extend schema {
          subscription: Subscription
        }
        type Subscription
      `);
      const extendedSchema = extendSchema(schema, extendAST);

      const mutationType = extendedSchema.getMutationType();
      expect(mutationType).to.include({ name: 'Mutation' });

      const subscriptionType = extendedSchema.getSubscriptionType();
      expect(subscriptionType).to.include({ name: 'Subscription' });
    });

    it('schema extension AST are available from schema object', () => {
      const schema = buildSchema(`
        type Query

        directive @foo on SCHEMA
      `);

      const extendAST = parse(`
        extend schema {
          mutation: Mutation
        }
        type Mutation

        extend schema {
          subscription: Subscription
        }
        type Subscription
      `);
      const extendedSchema = extendSchema(schema, extendAST);

      const secondExtendAST = parse('extend schema @foo');
      const extendedTwiceSchema = extendSchema(extendedSchema, secondExtendAST);

      expect(printExtensionNodes(extendedTwiceSchema)).to.equal(dedent`
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
