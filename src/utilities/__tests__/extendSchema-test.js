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
import { parse, print } from '../../language';
import { printSchema } from '../schemaPrinter';
import { Kind } from '../../language/kinds';
import { graphqlSync } from '../../';
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
  isScalarType,
  isNonNullType,
  validateSchema,
} from '../../type';

// Test schema.
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

const testSchema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: () => ({
      foo: { type: FooType },
      someUnion: { type: SomeUnionType },
      someEnum: { type: SomeEnumType },
      someInterface: {
        args: { id: { type: GraphQLNonNull(GraphQLID) } },
        type: SomeInterfaceType,
      },
    }),
  }),
  types: [FooType, BarType],
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
    expect(result.data).to.deep.equal({ newField: '123' });
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
  });

  it('correctly assign AST nodes to new and extended types', () => {
    const extendedSchema = extendTestSchema(`
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
    const secondExtensionAST = parse(`
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
      secondExtensionAST,
    );

    const query = extendedTwiceSchema.getType('Query');
    const testInput = extendedTwiceSchema.getType('TestInput');
    const testEnum = extendedTwiceSchema.getType('TestEnum');
    const testUnion = extendedTwiceSchema.getType('TestUnion');
    const testInterface = extendedTwiceSchema.getType('TestInterface');
    const testType = extendedTwiceSchema.getType('TestType');
    const testDirective = extendedTwiceSchema.getDirective('test');

    expect(query.extensionASTNodes).to.have.lengthOf(2);
    expect(testType.extensionASTNodes).to.equal(undefined);

    const restoredExtensionAST = {
      kind: Kind.DOCUMENT,
      definitions: [
        ...query.extensionASTNodes,
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

  it('extends objects by adding new unused types', () => {
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

  it('extends objects multiple times', () => {
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

      interface NewInterface {
        buzz: String
      }
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
    const ast = parse(`
      directive @include(if: Boolean!) on FIELD | FRAGMENT_SPREAD
    `);

    expect(() => extendSchema(testSchema, ast)).to.throw(
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

  it('does not allow extending an unknown interface type', () => {
    const ast = parse(`
      extend interface UnknownInterfaceType {
        baz: String
      }
    `);
    expect(() => extendSchema(testSchema, ast)).to.throw(
      'Cannot extend type "UnknownInterfaceType" because it does not ' +
        'exist in the existing schema.',
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
    expect(schema.__allowedLegacyNames).to.deep.equal(['__badName']);
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
    expect(schema.__allowedLegacyNames).to.deep.equal([
      '__badName',
      '__anotherBadName',
    ]);
  });

  it('extend enum', () => {
    const extendedSchema = extendTestSchema(`
      extend enum SomeEnum {
        NEW_ENUM
      }
    `);
    expect(extendedSchema).to.not.equal(testSchema);
    expect(printSchema(extendedSchema)).to.contain('NEW_ENUM');
    expect(printSchema(testSchema)).to.not.contain('NEW_ENUM');
  });

  it('extend input', () => {
    const extendedSchema = extendTestSchema(`
      extend type Query {
        newField(testArg: TestInput): String
      }

      input TestInput {
        testInputField: String
      }
    `);
    const secondExtensionAST = parse(`
      extend input TestInput {
        newInputField: String
      }
    `);
    const extendedTwiceSchema = extendSchema(
      extendedSchema,
      secondExtensionAST,
    );

    expect(extendedSchema).to.not.equal(testSchema);
    expect(printSchema(extendedTwiceSchema)).to.contain('newInputField');
    expect(printSchema(extendedSchema)).to.not.contain('newInputField');
    expect(printSchema(testSchema)).to.not.contain('newInputField');
  });

  it('extend union', () => {
    const extendedSchema = extendTestSchema(`
      extend union SomeUnion = TestNewType

      type TestNewType {
        foo: String
      }
    `);

    expect(extendedSchema).to.not.equal(testSchema);
    expect(printSchema(extendedSchema)).to.contain('Foo | Biz | TestNewType');
    expect(printSchema(testSchema)).to.not.contain('Foo | Biz | TestNewType');
  });

  describe('does not allow extending a non-object type', () => {
    it('not an object', () => {
      const ast = parse(`
        extend type SomeInterface {
          baz: String
        }
      `);
      expect(() => extendSchema(testSchema, ast)).to.throw(
        'Cannot extend non-object type "SomeInterface".',
      );
    });

    it('not an interface', () => {
      const ast = parse(`
        extend interface Foo {
          baz: String
        }
      `);
      expect(() => extendSchema(testSchema, ast)).to.throw(
        'Cannot extend non-interface type "Foo".',
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

  describe('can add additional root operation types', () => {
    it('does not automatically include common root type names', () => {
      const ast = parse(`
        type Mutation {
          doSomething: String
        }
      `);
      const schema = extendSchema(testSchema, ast);
      expect(schema.getMutationType()).to.equal(null);
    });

    it('does not allow new schema within an extension', () => {
      const ast = parse(`
        schema {
          mutation: Mutation
        }

        type Mutation {
          doSomething: String
        }
      `);
      expect(() => extendSchema(testSchema, ast)).to.throw(
        'Cannot define a new schema within a schema extension.',
      );
    });

    it('adds new root types via schema extension', () => {
      const ast = parse(`
        extend schema {
          mutation: Mutation
        }

        type Mutation {
          doSomething: String
        }
      `);
      const schema = extendSchema(testSchema, ast);
      const mutationType = schema.getMutationType();
      expect(mutationType && mutationType.name).to.equal('Mutation');
    });

    it('adds multiple new root types via schema extension', () => {
      const ast = parse(`
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
      const schema = extendSchema(testSchema, ast);
      const mutationType = schema.getMutationType();
      const subscriptionType = schema.getSubscriptionType();
      expect(mutationType && mutationType.name).to.equal('Mutation');
      expect(subscriptionType && subscriptionType.name).to.equal(
        'Subscription',
      );
    });

    it('applies multiple schema extensions', () => {
      const ast = parse(`
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
      const schema = extendSchema(testSchema, ast);
      const mutationType = schema.getMutationType();
      const subscriptionType = schema.getSubscriptionType();
      expect(mutationType && mutationType.name).to.equal('Mutation');
      expect(subscriptionType && subscriptionType.name).to.equal(
        'Subscription',
      );
    });

    it('schema extension AST are available from schema object', () => {
      const ast = parse(`
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
      const schema = extendSchema(testSchema, ast);
      expect(schema.extensionASTNodes.map(print).join('\n')).to.equal(dedent`
        extend schema {
          mutation: Mutation
        }
        extend schema {
          subscription: Subscription
        }`);
    });

    it('does not allow redefining an existing root type', () => {
      const ast = parse(`
        extend schema {
          query: SomeType
        }

        type SomeType {
          seeSomething: String
        }
      `);
      expect(() => extendSchema(testSchema, ast)).to.throw(
        'Must provide only one query type in schema.',
      );
    });

    it('does not allow defining a root operation type twice', () => {
      const ast = parse(`
        extend schema {
          mutation: Mutation
        }

        extend schema {
          mutation: Mutation
        }

        type Mutation {
          doSomething: String
        }
      `);
      expect(() => extendSchema(testSchema, ast)).to.throw(
        'Must provide only one mutation type in schema.',
      );
    });

    it('does not allow defining a root operation type with different types', () => {
      const ast = parse(`
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
      `);
      expect(() => extendSchema(testSchema, ast)).to.throw(
        'Must provide only one mutation type in schema.',
      );
    });
  });
});
