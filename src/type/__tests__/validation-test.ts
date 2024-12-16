import { assert, expect } from 'chai';
import { describe, it } from 'mocha';

import { dedent } from '../../__testUtils__/dedent.js';
import { expectJSON } from '../../__testUtils__/expectJSON.js';

import { inspect } from '../../jsutils/inspect.js';

import { DirectiveLocation } from '../../language/directiveLocation.js';
import { parse } from '../../language/parser.js';

import { buildSchema } from '../../utilities/buildASTSchema.js';
import { extendSchema } from '../../utilities/extendSchema.js';

import type {
  GraphQLArgumentConfig,
  GraphQLFieldConfig,
  GraphQLInputFieldConfig,
  GraphQLInputType,
  GraphQLNamedType,
  GraphQLOutputType,
} from '../definition.js';
import {
  assertEnumType,
  assertInputObjectType,
  assertInterfaceType,
  assertObjectType,
  assertScalarType,
  assertUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
} from '../definition.js';
import { assertDirective, GraphQLDirective } from '../directives.js';
import { GraphQLInt, GraphQLString } from '../scalars.js';
import { GraphQLSchema } from '../schema.js';
import { assertValidSchema, validateSchema } from '../validate.js';

const SomeSchema = buildSchema(`
  scalar SomeScalar

  interface SomeInterface { f: SomeObject }

  type SomeObject implements SomeInterface { f: SomeObject }

  union SomeUnion = SomeObject

  enum SomeEnum { ONLY }

  input SomeInputObject { val: String = "hello" }

  directive @SomeDirective on QUERY
`);

const SomeScalarType = assertScalarType(SomeSchema.getType('SomeScalar'));
const SomeInterfaceType = assertInterfaceType(
  SomeSchema.getType('SomeInterface'),
);
const SomeObjectType = assertObjectType(SomeSchema.getType('SomeObject'));
const SomeUnionType = assertUnionType(SomeSchema.getType('SomeUnion'));
const SomeEnumType = assertEnumType(SomeSchema.getType('SomeEnum'));
const SomeInputObjectType = assertInputObjectType(
  SomeSchema.getType('SomeInputObject'),
);

const SomeDirective = assertDirective(SomeSchema.getDirective('SomeDirective'));

function withModifiers<T extends GraphQLNamedType>(
  type: T,
): Array<T | GraphQLList<T> | GraphQLNonNull<T | GraphQLList<T>>> {
  return [
    type,
    new GraphQLList(type),
    new GraphQLNonNull(type),
    new GraphQLNonNull(new GraphQLList(type)),
  ];
}

const outputTypes: ReadonlyArray<GraphQLOutputType> = [
  ...withModifiers(GraphQLString),
  ...withModifiers(SomeScalarType),
  ...withModifiers(SomeEnumType),
  ...withModifiers(SomeObjectType),
  ...withModifiers(SomeUnionType),
  ...withModifiers(SomeInterfaceType),
];

const notOutputTypes: ReadonlyArray<GraphQLInputType> = [
  ...withModifiers(SomeInputObjectType),
];

const inputTypes: ReadonlyArray<GraphQLInputType> = [
  ...withModifiers(GraphQLString),
  ...withModifiers(SomeScalarType),
  ...withModifiers(SomeEnumType),
  ...withModifiers(SomeInputObjectType),
];

const notInputTypes: ReadonlyArray<GraphQLOutputType> = [
  ...withModifiers(SomeObjectType),
  ...withModifiers(SomeUnionType),
  ...withModifiers(SomeInterfaceType),
];

function schemaWithFieldType(type: GraphQLOutputType): GraphQLSchema {
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: { f: { type } },
    }),
  });
}

describe('Type System: A Schema must have Object root types', () => {
  it('accepts a Schema whose query type is an object type', () => {
    const schema = buildSchema(`
      type Query {
        test: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([]);

    const schemaWithDef = buildSchema(`
      schema {
        query: QueryRoot
      }

      type QueryRoot {
        test: String
      }
    `);
    expectJSON(validateSchema(schemaWithDef)).toDeepEqual([]);
  });

  it('accepts a Schema whose query and mutation types are object types', () => {
    const schema = buildSchema(`
      type Query {
        test: String
      }

      type Mutation {
        test: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([]);

    const schemaWithDef = buildSchema(`
      schema {
        query: QueryRoot
        mutation: MutationRoot
      }

      type QueryRoot {
        test: String
      }

      type MutationRoot {
        test: String
      }
    `);
    expectJSON(validateSchema(schemaWithDef)).toDeepEqual([]);
  });

  it('accepts a Schema whose query and subscription types are object types', () => {
    const schema = buildSchema(`
      type Query {
        test: String
      }

      type Subscription {
        test: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([]);

    const schemaWithDef = buildSchema(`
      schema {
        query: QueryRoot
        subscription: SubscriptionRoot
      }

      type QueryRoot {
        test: String
      }

      type SubscriptionRoot {
        test: String
      }
    `);
    expectJSON(validateSchema(schemaWithDef)).toDeepEqual([]);
  });

  it('rejects a Schema without a query type', () => {
    const schema = buildSchema(`
      type Mutation {
        test: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message: 'Query root type must be provided.',
      },
    ]);

    const schemaWithDef = buildSchema(`
      schema {
        mutation: MutationRoot
      }

      type MutationRoot {
        test: String
      }
    `);
    expectJSON(validateSchema(schemaWithDef)).toDeepEqual([
      {
        message: 'Query root type must be provided.',
        locations: [{ line: 2, column: 7 }],
      },
    ]);
  });

  it('rejects a Schema whose query root type is not an Object type', () => {
    const schema = buildSchema(`
      input Query {
        test: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message: 'Query root type must be Object type, it cannot be Query.',
        locations: [{ line: 2, column: 7 }],
      },
    ]);

    const schemaWithDef = buildSchema(`
      schema {
        query: SomeInputObject
      }

      input SomeInputObject {
        test: String
      }
    `);
    expectJSON(validateSchema(schemaWithDef)).toDeepEqual([
      {
        message:
          'Query root type must be Object type, it cannot be SomeInputObject.',
        locations: [{ line: 3, column: 16 }],
      },
    ]);
  });

  it('rejects a Schema whose mutation type is an input type', () => {
    const schema = buildSchema(`
      type Query {
        field: String
      }

      input Mutation {
        test: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Mutation root type must be Object type if provided, it cannot be Mutation.',
        locations: [{ line: 6, column: 7 }],
      },
    ]);

    const schemaWithDef = buildSchema(`
      schema {
        query: Query
        mutation: SomeInputObject
      }

      type Query {
        field: String
      }

      input SomeInputObject {
        test: String
      }
    `);
    expectJSON(validateSchema(schemaWithDef)).toDeepEqual([
      {
        message:
          'Mutation root type must be Object type if provided, it cannot be SomeInputObject.',
        locations: [{ line: 4, column: 19 }],
      },
    ]);
  });

  it('rejects a Schema whose subscription type is an input type', () => {
    const schema = buildSchema(`
      type Query {
        field: String
      }

      input Subscription {
        test: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Subscription root type must be Object type if provided, it cannot be Subscription.',
        locations: [{ line: 6, column: 7 }],
      },
    ]);

    const schemaWithDef = buildSchema(`
      schema {
        query: Query
        subscription: SomeInputObject
      }

      type Query {
        field: String
      }

      input SomeInputObject {
        test: String
      }
    `);
    expectJSON(validateSchema(schemaWithDef)).toDeepEqual([
      {
        message:
          'Subscription root type must be Object type if provided, it cannot be SomeInputObject.',
        locations: [{ line: 4, column: 23 }],
      },
    ]);
  });

  it('rejects a Schema extended with invalid root types', () => {
    let schema = buildSchema(`
      input SomeInputObject {
        test: String
      }

      scalar SomeScalar

      enum SomeEnum {
        ENUM_VALUE
      }
    `);

    schema = extendSchema(
      schema,
      parse(`
        extend schema {
          query: SomeInputObject
        }
      `),
    );

    schema = extendSchema(
      schema,
      parse(`
        extend schema {
          mutation: SomeScalar
        }
      `),
    );

    schema = extendSchema(
      schema,
      parse(`
        extend schema {
          subscription: SomeEnum
        }
      `),
    );

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Query root type must be Object type, it cannot be SomeInputObject.',
        locations: [{ line: 3, column: 18 }],
      },
      {
        message:
          'Mutation root type must be Object type if provided, it cannot be SomeScalar.',
        locations: [{ line: 3, column: 21 }],
      },
      {
        message:
          'Subscription root type must be Object type if provided, it cannot be SomeEnum.',
        locations: [{ line: 3, column: 25 }],
      },
    ]);
  });

  it('rejects a Schema whose types are incorrectly typed', () => {
    const schema = new GraphQLSchema({
      query: SomeObjectType,
      // @ts-expect-error
      types: [{ name: 'SomeType' }, SomeDirective],
    });
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message: 'Expected GraphQL named type but got: { name: "SomeType" }.',
      },
      {
        message: 'Expected GraphQL named type but got: @SomeDirective.',
        locations: [{ line: 14, column: 3 }],
      },
    ]);
  });

  it('rejects a Schema whose directives are incorrectly typed', () => {
    const schema = new GraphQLSchema({
      query: SomeObjectType,
      // @ts-expect-error
      directives: [null, 'SomeDirective', SomeScalarType],
    });
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message: 'Expected directive but got: null.',
      },
      {
        message: 'Expected directive but got: "SomeDirective".',
      },
      {
        message: 'Expected directive but got: SomeScalar.',
        locations: [{ line: 2, column: 3 }],
      },
    ]);
  });

  it('rejects a Schema whose directives have empty locations', () => {
    const badDirective = new GraphQLDirective({
      name: 'BadDirective',
      args: {},
      locations: [],
    });
    const schema = new GraphQLSchema({
      query: SomeObjectType,
      directives: [badDirective],
    });
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message: 'Directive @BadDirective must include 1 or more locations.',
      },
    ]);
  });
});

describe('Type System: Root types must all be different if provided', () => {
  it('accepts a Schema with different root types', () => {
    const schema = buildSchema(`
      type SomeObject1 {
        field: String
      }

      type SomeObject2 {
        field: String
      }

      type SomeObject3 {
        field: String
      }

      schema {
        query: SomeObject1
        mutation: SomeObject2
        subscription: SomeObject3
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([]);
  });

  it('rejects a Schema where the same type is used for multiple root types', () => {
    const schema = buildSchema(`
      type SomeObject {
        field: String
      }

      type UniqueObject {
        field: String
      }

      schema {
        query: SomeObject
        mutation: UniqueObject
        subscription: SomeObject
      }
    `);

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'All root types must be different, "SomeObject" type is used as query and subscription root types.',
        locations: [
          { line: 11, column: 16 },
          { line: 13, column: 23 },
        ],
      },
    ]);
  });

  it('rejects a Schema where the same type is used for all root types', () => {
    const schema = buildSchema(`
      type SomeObject {
        field: String
      }

      schema {
        query: SomeObject
        mutation: SomeObject
        subscription: SomeObject
      }
    `);

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'All root types must be different, "SomeObject" type is used as query, mutation, and subscription root types.',
        locations: [
          { line: 7, column: 16 },
          { line: 8, column: 19 },
          { line: 9, column: 23 },
        ],
      },
    ]);
  });
});

describe('Type System: Objects must have fields', () => {
  it('accepts an Object type with fields object', () => {
    const schema = buildSchema(`
      type Query {
        field: SomeObject
      }

      type SomeObject {
        field: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([]);
  });

  it('rejects an Object type with missing fields', () => {
    const schema = buildSchema(`
      type Query {
        test: IncompleteObject
      }

      type IncompleteObject
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message: 'Type IncompleteObject must define one or more fields.',
        locations: [{ line: 6, column: 7 }],
      },
    ]);

    const manualSchema = schemaWithFieldType(
      new GraphQLObjectType({
        name: 'IncompleteObject',
        fields: {},
      }),
    );
    expectJSON(validateSchema(manualSchema)).toDeepEqual([
      {
        message: 'Type IncompleteObject must define one or more fields.',
      },
    ]);

    const manualSchema2 = schemaWithFieldType(
      new GraphQLObjectType({
        name: 'IncompleteObject',
        fields() {
          return {};
        },
      }),
    );
    expectJSON(validateSchema(manualSchema2)).toDeepEqual([
      {
        message: 'Type IncompleteObject must define one or more fields.',
      },
    ]);
  });

  it('rejects an Object type with incorrectly named fields', () => {
    const schema = schemaWithFieldType(
      new GraphQLObjectType({
        name: 'SomeObject',
        fields: {
          __badName: { type: GraphQLString },
        },
      }),
    );
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Name "__badName" must not begin with "__", which is reserved by GraphQL introspection.',
      },
    ]);
  });
});

describe('Type System: Fields args must be properly named', () => {
  it('accepts field args with valid names', () => {
    const schema = schemaWithFieldType(
      new GraphQLObjectType({
        name: 'SomeObject',
        fields: {
          goodField: {
            type: GraphQLString,
            args: {
              goodArg: { type: GraphQLString },
            },
          },
        },
      }),
    );
    expectJSON(validateSchema(schema)).toDeepEqual([]);
  });

  it('rejects field arg with invalid names', () => {
    const schema = schemaWithFieldType(
      new GraphQLObjectType({
        name: 'SomeObject',
        fields: {
          badField: {
            type: GraphQLString,
            args: {
              __badName: { type: GraphQLString },
            },
          },
        },
      }),
    );

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Name "__badName" must not begin with "__", which is reserved by GraphQL introspection.',
      },
    ]);
  });
});

describe('Type System: Union types must be valid', () => {
  it('accepts a Union type with member types', () => {
    const schema = buildSchema(`
      type Query {
        test: GoodUnion
      }

      type TypeA {
        field: String
      }

      type TypeB {
        field: String
      }

      union GoodUnion =
        | TypeA
        | TypeB
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([]);
  });

  it('rejects a Union type with empty types', () => {
    let schema = buildSchema(`
      type Query {
        test: BadUnion
      }

      union BadUnion
    `);

    schema = extendSchema(
      schema,
      parse(`
        directive @test on UNION

        extend union BadUnion @test
      `),
    );

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message: 'Union type BadUnion must define one or more member types.',
        locations: [
          { line: 6, column: 7 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('rejects a Union type with duplicated member type', () => {
    let schema = buildSchema(`
      type Query {
        test: BadUnion
      }

      type TypeA {
        field: String
      }

      type TypeB {
        field: String
      }

      union BadUnion =
        | TypeA
        | TypeB
        | TypeA
    `);

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message: 'Union type BadUnion can only include type TypeA once.',
        locations: [
          { line: 15, column: 11 },
          { line: 17, column: 11 },
        ],
      },
    ]);

    schema = extendSchema(schema, parse('extend union BadUnion = TypeB'));

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message: 'Union type BadUnion can only include type TypeA once.',
        locations: [
          { line: 15, column: 11 },
          { line: 17, column: 11 },
        ],
      },
      {
        message: 'Union type BadUnion can only include type TypeB once.',
        locations: [
          { line: 16, column: 11 },
          { line: 1, column: 25 },
        ],
      },
    ]);
  });

  it('rejects a Union type with non-Object members types', () => {
    let schema = buildSchema(`
      type Query {
        test: BadUnion
      }

      type TypeA {
        field: String
      }

      type TypeB {
        field: String
      }

      union BadUnion =
        | TypeA
        | String
        | TypeB
    `);

    schema = extendSchema(schema, parse('extend union BadUnion = Int'));

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Union type BadUnion can only include Object types, it cannot include String.',
        locations: [{ line: 16, column: 11 }],
      },
      {
        message:
          'Union type BadUnion can only include Object types, it cannot include Int.',
        locations: [{ line: 1, column: 25 }],
      },
    ]);

    const badUnionMemberTypes = [
      GraphQLString,
      new GraphQLNonNull(SomeObjectType),
      new GraphQLList(SomeObjectType),
      SomeInterfaceType,
      SomeUnionType,
      SomeEnumType,
      SomeInputObjectType,
    ];
    for (const memberType of badUnionMemberTypes) {
      const badUnion = new GraphQLUnionType({
        name: 'BadUnion',
        // @ts-expect-error
        types: [memberType],
      });
      const badSchema = schemaWithFieldType(badUnion);
      expectJSON(validateSchema(badSchema)).toDeepEqual([
        {
          message:
            'Union type BadUnion can only include Object types, ' +
            `it cannot include ${inspect(memberType)}.`,
        },
      ]);
    }
  });

  it('rejects a Union type with non-Object members types with malformed AST', () => {
    const schema = buildSchema(`
      type Query {
        test: BadUnion
      }

      type TypeA {
        field: String
      }

      type TypeB {
        field: String
      }

      union BadUnion =
        | TypeA
        | String
        | TypeB
    `);

    const badUnionNode = (schema.getType('BadUnion') as GraphQLUnionType)
      ?.astNode;
    assert(badUnionNode);
    /* @ts-expect-error */
    badUnionNode.types = undefined;

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Union type BadUnion can only include Object types, it cannot include String.',
      },
    ]);
  });
});

describe('Type System: Input Objects must have fields', () => {
  it('accepts an Input Object type with fields', () => {
    const schema = buildSchema(`
      type Query {
        field(arg: SomeInputObject): String
      }

      input SomeInputObject {
        field: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([]);
  });

  it('rejects an Input Object type with missing fields', () => {
    let schema = buildSchema(`
      type Query {
        field(arg: SomeInputObject): String
      }

      input SomeInputObject
    `);

    schema = extendSchema(
      schema,
      parse(`
        directive @test on INPUT_OBJECT

        extend input SomeInputObject @test
      `),
    );

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Input Object type SomeInputObject must define one or more fields.',
        locations: [
          { line: 6, column: 7 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('accepts an Input Object with breakable circular reference', () => {
    const schema = buildSchema(`
      type Query {
        field(arg: SomeInputObject): String
      }

      input SomeInputObject {
        self: SomeInputObject
        arrayOfSelf: [SomeInputObject]
        nonNullArrayOfSelf: [SomeInputObject]!
        nonNullArrayOfNonNullSelf: [SomeInputObject!]!
        intermediateSelf: AnotherInputObject
      }

      input AnotherInputObject {
        parent: SomeInputObject
      }
    `);

    expectJSON(validateSchema(schema)).toDeepEqual([]);
  });

  it('rejects an Input Object with non-breakable circular reference', () => {
    const schema = buildSchema(`
      type Query {
        field(arg: SomeInputObject): String
      }

      input SomeInputObject {
        nonNullSelf: SomeInputObject!
      }
    `);

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Invalid circular reference. The Input Object SomeInputObject references itself in the non-null field SomeInputObject.nonNullSelf.',
        locations: [{ line: 7, column: 9 }],
      },
    ]);
  });

  it('rejects Input Objects with non-breakable circular reference spread across them', () => {
    const schema = buildSchema(`
      type Query {
        field(arg: SomeInputObject): String
      }

      input SomeInputObject {
        startLoop: AnotherInputObject!
      }

      input AnotherInputObject {
        nextInLoop: YetAnotherInputObject!
      }

      input YetAnotherInputObject {
        closeLoop: SomeInputObject!
      }
    `);

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Invalid circular reference. The Input Object SomeInputObject references itself via the non-null fields: SomeInputObject.startLoop, AnotherInputObject.nextInLoop, YetAnotherInputObject.closeLoop.',
        locations: [
          { line: 7, column: 9 },
          { line: 11, column: 9 },
          { line: 15, column: 9 },
        ],
      },
    ]);
  });

  it('rejects Input Objects with multiple non-breakable circular reference', () => {
    const schema = buildSchema(`
      type Query {
        field(arg: SomeInputObject): String
      }

      input SomeInputObject {
        startLoop: AnotherInputObject!
      }

      input AnotherInputObject {
        closeLoop: SomeInputObject!
        startSecondLoop: YetAnotherInputObject!
      }

      input YetAnotherInputObject {
        closeSecondLoop: AnotherInputObject!
        nonNullSelf: YetAnotherInputObject!
      }
    `);

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Invalid circular reference. The Input Object SomeInputObject references itself via the non-null fields: SomeInputObject.startLoop, AnotherInputObject.closeLoop.',
        locations: [
          { line: 7, column: 9 },
          { line: 11, column: 9 },
        ],
      },
      {
        message:
          'Invalid circular reference. The Input Object AnotherInputObject references itself via the non-null fields: AnotherInputObject.startSecondLoop, YetAnotherInputObject.closeSecondLoop.',
        locations: [
          { line: 12, column: 9 },
          { line: 16, column: 9 },
        ],
      },
      {
        message:
          'Invalid circular reference. The Input Object YetAnotherInputObject references itself in the non-null field YetAnotherInputObject.nonNullSelf.',
        locations: [{ line: 17, column: 9 }],
      },
    ]);
  });

  it('accepts Input Objects with default values without circular references (SDL)', () => {
    const validSchema = buildSchema(`
      type Query {
        field(arg1: A, arg2: B): String
      }

      input A {
        x: A = null
        y: A = { x: null, y: null }
        z: [A] = []
      }

      input B {
        x: B2! = {}
        y: String = "abc"
        z: Custom = {}
      }

      input B2 {
        x: B3 = {}
      }

      input B3 {
        x: B = { x: { x: null } }
      }

      scalar Custom
    `);

    expect(validateSchema(validSchema)).to.deep.equal([]);
  });

  it('accepts Input Objects with default values without circular references (programmatic)', () => {
    const AType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'A',
      fields: () => ({
        x: { type: AType, default: { value: null } },
        y: { type: AType, default: { value: { x: null, y: null } } },
        z: { type: new GraphQLList(AType), default: { value: [] } },
      }),
    });

    const BType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'B',
      fields: () => ({
        x: { type: new GraphQLNonNull(B2Type), default: { value: {} } },
        y: { type: GraphQLString, default: { value: 'abc' } },
        z: { type: CustomType, default: { value: {} } },
      }),
    });

    const B2Type: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'B2',
      fields: () => ({
        x: { type: B3Type, default: { value: {} } },
      }),
    });

    const B3Type: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'B3',
      fields: () => ({
        x: { type: BType, default: { value: { x: { x: null } } } },
      }),
    });

    const CustomType = new GraphQLScalarType({ name: 'Custom' });

    const validSchema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: {
            type: GraphQLString,
            args: {
              arg1: { type: AType },
              arg2: { type: BType },
            },
          },
        },
      }),
    });

    expect(validateSchema(validSchema)).to.deep.equal([]);
  });

  it('rejects Input Objects with default value circular reference (SDL)', () => {
    const invalidSchema = buildSchema(`
      type Query {
        field(arg1: A, arg2: B, arg3: C, arg4: D, arg5: E): String
      }

      input A {
        x: A = {}
      }

      input B {
        x: B2 = {}
      }

      input B2 {
        x: B3 = {}
      }

      input B3 {
        x: B = {}
      }

      input C {
        x: [C] = [{}]
      }

      input D {
        x: D = { x: { x: {} } }
      }

      input E {
        x: E = { x: null }
        y: E = { y: null }
      }

      input F {
        x: F2! = {}
      }

      input F2 {
        x: F = { x: {} }
      }
    `);

    expectJSON(validateSchema(invalidSchema)).toDeepEqual([
      {
        message:
          'Invalid circular reference. The default value of Input Object field A.x references itself.',
        locations: [{ line: 7, column: 16 }],
      },
      {
        message:
          'Invalid circular reference. The default value of Input Object field B.x references itself via the default values of: B2.x, B3.x.',
        locations: [
          { line: 11, column: 17 },
          { line: 15, column: 17 },
          { line: 19, column: 16 },
        ],
      },
      {
        message:
          'Invalid circular reference. The default value of Input Object field C.x references itself.',
        locations: [{ line: 23, column: 18 }],
      },
      {
        message:
          'Invalid circular reference. The default value of Input Object field D.x references itself.',
        locations: [{ line: 27, column: 16 }],
      },
      {
        message:
          'Invalid circular reference. The default value of Input Object field E.x references itself via the default values of: E.y.',
        locations: [
          { line: 31, column: 16 },
          { line: 32, column: 16 },
        ],
      },
      {
        message:
          'Invalid circular reference. The default value of Input Object field F2.x references itself.',
        locations: [{ line: 40, column: 16 }],
      },
    ]);
  });

  it('rejects Input Objects with default value circular reference (programmatic)', () => {
    const AType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'A',
      fields: () => ({
        x: { type: AType, default: { value: {} } },
      }),
    });

    const BType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'B',
      fields: () => ({
        x: { type: B2Type, default: { value: {} } },
      }),
    });

    const B2Type: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'B2',
      fields: () => ({
        x: { type: B3Type, default: { value: {} } },
      }),
    });

    const B3Type: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'B3',
      fields: () => ({
        x: { type: BType, default: { value: {} } },
      }),
    });

    const CType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'C',
      fields: () => ({
        x: { type: new GraphQLList(CType), default: { value: [{}] } },
      }),
    });

    const DType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'D',
      fields: () => ({
        x: { type: DType, default: { value: { x: { x: {} } } } },
      }),
    });

    const EType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'E',
      fields: () => ({
        x: { type: EType, default: { value: { x: null } } },
        y: { type: EType, default: { value: { y: null } } },
      }),
    });

    const FType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'F',
      fields: () => ({
        x: { type: new GraphQLNonNull(F2Type), default: { value: {} } },
      }),
    });

    const F2Type: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'F2',
      fields: () => ({
        x: { type: FType, default: { value: { x: {} } } },
      }),
    });

    const invalidSchema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: {
            type: GraphQLString,
            args: {
              arg1: { type: AType },
              arg2: { type: BType },
              arg3: { type: CType },
              arg4: { type: DType },
              arg5: { type: EType },
              arg6: { type: FType },
            },
          },
        },
      }),
    });

    expectJSON(validateSchema(invalidSchema)).toDeepEqual([
      {
        message:
          'Invalid circular reference. The default value of Input Object field A.x references itself.',
      },
      {
        message:
          'Invalid circular reference. The default value of Input Object field B.x references itself via the default values of: B2.x, B3.x.',
      },
      {
        message:
          'Invalid circular reference. The default value of Input Object field C.x references itself.',
      },
      {
        message:
          'Invalid circular reference. The default value of Input Object field D.x references itself.',
      },
      {
        message:
          'Invalid circular reference. The default value of Input Object field E.x references itself via the default values of: E.y.',
      },
      {
        message:
          'Invalid circular reference. The default value of Input Object field F2.x references itself.',
      },
    ]);
  });

  it('rejects an Input Object type with incorrectly typed fields', () => {
    const schema = buildSchema(`
      type Query {
        field(arg: SomeInputObject): String
      }

      type SomeObject {
        field: String
      }

      union SomeUnion = SomeObject

      input SomeInputObject {
        badObject: SomeObject
        badUnion: SomeUnion
        goodInputObject: SomeInputObject
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'The type of SomeInputObject.badObject must be Input Type but got: SomeObject.',
        locations: [{ line: 13, column: 20 }],
      },
      {
        message:
          'The type of SomeInputObject.badUnion must be Input Type but got: SomeUnion.',
        locations: [{ line: 14, column: 19 }],
      },
    ]);
  });

  it('rejects an Input Object type with required field that is deprecated', () => {
    const schema = buildSchema(`
      type Query {
        field(arg: SomeInputObject): String
      }

      input SomeInputObject {
        badField: String! @deprecated
        optionalField: String @deprecated
        anotherOptionalField: String! = "" @deprecated
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Required input field SomeInputObject.badField cannot be deprecated.',
        locations: [
          { line: 7, column: 27 },
          { line: 7, column: 19 },
        ],
      },
    ]);
  });
});

describe('Type System: Enum types must be well defined', () => {
  it('rejects an Enum type without values', () => {
    let schema = buildSchema(`
      type Query {
        field: SomeEnum
      }

      enum SomeEnum
    `);

    schema = extendSchema(
      schema,
      parse(`
        directive @test on ENUM

        extend enum SomeEnum @test
      `),
    );

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message: 'Enum type SomeEnum must define one or more values.',
        locations: [
          { line: 6, column: 7 },
          { line: 4, column: 9 },
        ],
      },
    ]);
  });

  it('rejects an Enum type with incorrectly named values', () => {
    const schema = schemaWithFieldType(
      new GraphQLEnumType({
        name: 'SomeEnum',
        values: {
          __badName: {},
        },
      }),
    );

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Name "__badName" must not begin with "__", which is reserved by GraphQL introspection.',
      },
    ]);
  });
});

describe('Type System: Object fields must have output types', () => {
  function schemaWithObjectField(
    fieldConfig: GraphQLFieldConfig<unknown, unknown>,
  ): GraphQLSchema {
    const BadObjectType = new GraphQLObjectType({
      name: 'BadObject',
      fields: {
        badField: fieldConfig,
      },
    });

    return new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          f: { type: BadObjectType },
        },
      }),
      types: [SomeObjectType],
    });
  }

  for (const type of outputTypes) {
    const typeName = inspect(type);
    it(`accepts an output type as an Object field type: ${typeName}`, () => {
      const schema = schemaWithObjectField({ type });
      expectJSON(validateSchema(schema)).toDeepEqual([]);
    });
  }

  it('rejects an empty Object field type', () => {
    // @ts-expect-error (type field must not be undefined)
    const schema = schemaWithObjectField({ type: undefined });
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'The type of BadObject.badField must be Output Type but got: undefined.',
      },
    ]);
  });

  for (const type of notOutputTypes) {
    const typeStr = inspect(type);
    it(`rejects a non-output type as an Object field type: ${typeStr}`, () => {
      // @ts-expect-error
      const schema = schemaWithObjectField({ type });
      expectJSON(validateSchema(schema)).toDeepEqual([
        {
          message: `The type of BadObject.badField must be Output Type but got: ${typeStr}.`,
        },
      ]);
    });
  }

  it('rejects a non-type value as an Object field type', () => {
    // @ts-expect-error
    const schema = schemaWithObjectField({ type: Number });
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'The type of BadObject.badField must be Output Type but got: [function Number].',
      },
      {
        message: 'Expected GraphQL named type but got: [function Number].',
      },
    ]);
  });

  it('rejects with relevant locations for a non-output type as an Object field type', () => {
    const schema = buildSchema(`
      type Query {
        field: [SomeInputObject]
      }

      input SomeInputObject {
        field: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'The type of Query.field must be Output Type but got: [SomeInputObject].',
        locations: [{ line: 3, column: 16 }],
      },
    ]);
  });
});

describe('Type System: Objects can only implement unique interfaces', () => {
  it('rejects an Object implementing a non-type value', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'BadObject',
        // @ts-expect-error (interfaces must not contain undefined)
        interfaces: [undefined],
        fields: { f: { type: GraphQLString } },
      }),
    });

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Type BadObject must only implement Interface types, it cannot implement undefined.',
      },
    ]);
  });

  it('rejects an Object implementing a non-Interface type', () => {
    const schema = buildSchema(`
      type Query {
        test: BadObject
      }

      input SomeInputObject {
        field: String
      }

      type BadObject implements SomeInputObject {
        field: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Type BadObject must only implement Interface types, it cannot implement SomeInputObject.',
        locations: [{ line: 10, column: 33 }],
      },
    ]);
  });

  it('rejects an Object implementing a non-Interface type with malformed AST', () => {
    const schema = buildSchema(`
      type Query {
        test: BadObject
      }

      input SomeInputObject {
        field: String
      }

      type BadObject implements SomeInputObject {
        field: String
      }
    `);

    const badObjectNode = (schema.getType('BadObject') as GraphQLObjectType)
      ?.astNode;
    assert(badObjectNode);
    /* @ts-expect-error */
    badObjectNode.interfaces = undefined;

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Type BadObject must only implement Interface types, it cannot implement SomeInputObject.',
      },
    ]);
  });

  it('rejects an Object implementing the same interface twice', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      interface AnotherInterface {
        field: String
      }

      type AnotherObject implements AnotherInterface & AnotherInterface {
        field: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message: 'Type AnotherObject can only implement AnotherInterface once.',
        locations: [
          { line: 10, column: 37 },
          { line: 10, column: 56 },
        ],
      },
    ]);
  });

  it('rejects an Object implementing the same interface twice due to extension', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      interface AnotherInterface {
        field: String
      }

      type AnotherObject implements AnotherInterface {
        field: String
      }
    `);
    const extendedSchema = extendSchema(
      schema,
      parse('extend type AnotherObject implements AnotherInterface'),
    );
    expectJSON(validateSchema(extendedSchema)).toDeepEqual([
      {
        message: 'Type AnotherObject can only implement AnotherInterface once.',
        locations: [
          { line: 10, column: 37 },
          { line: 1, column: 38 },
        ],
      },
    ]);
  });
});

describe('Type System: Interface extensions should be valid', () => {
  it('rejects an Object implementing the extended interface due to missing field', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      interface AnotherInterface {
        field: String
      }

      type AnotherObject implements AnotherInterface {
        field: String
      }
    `);
    const extendedSchema = extendSchema(
      schema,
      parse(`
        extend interface AnotherInterface {
          newField: String
        }

        extend type AnotherObject {
          differentNewField: String
        }
      `),
    );
    expectJSON(validateSchema(extendedSchema)).toDeepEqual([
      {
        message:
          'Interface field AnotherInterface.newField expected but AnotherObject does not provide it.',
        locations: [
          { line: 3, column: 11 },
          { line: 10, column: 7 },
          { line: 6, column: 9 },
        ],
      },
    ]);
  });

  it('rejects an Object implementing the extended interface due to missing field args', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      interface AnotherInterface {
        field: String
      }

      type AnotherObject implements AnotherInterface {
        field: String
      }
    `);
    const extendedSchema = extendSchema(
      schema,
      parse(`
        extend interface AnotherInterface {
          newField(test: Boolean): String
        }

        extend type AnotherObject {
          newField: String
        }
      `),
    );
    expectJSON(validateSchema(extendedSchema)).toDeepEqual([
      {
        message:
          'Interface field argument AnotherInterface.newField(test:) expected but AnotherObject.newField does not provide it.',
        locations: [
          { line: 3, column: 20 },
          { line: 7, column: 11 },
        ],
      },
    ]);
  });

  it('rejects Objects implementing the extended interface due to mismatching interface type', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      interface AnotherInterface {
        field: String
      }

      type AnotherObject implements AnotherInterface {
        field: String
      }
    `);
    const extendedSchema = extendSchema(
      schema,
      parse(`
        extend interface AnotherInterface {
          newInterfaceField: NewInterface
        }

        interface NewInterface {
          newField: String
        }

        interface MismatchingInterface {
          newField: String
        }

        extend type AnotherObject {
          newInterfaceField: MismatchingInterface
        }

        # Required to prevent unused interface errors
        type DummyObject implements NewInterface & MismatchingInterface {
          newField: String
        }
      `),
    );
    expectJSON(validateSchema(extendedSchema)).toDeepEqual([
      {
        message:
          'Interface field AnotherInterface.newInterfaceField expects type NewInterface but AnotherObject.newInterfaceField is type MismatchingInterface.',
        locations: [
          { line: 3, column: 30 },
          { line: 15, column: 30 },
        ],
      },
    ]);
  });
});

describe('Type System: Interface fields must have output types', () => {
  function schemaWithInterfaceField(
    fieldConfig: GraphQLFieldConfig<unknown, unknown>,
  ): GraphQLSchema {
    const fields = { badField: fieldConfig };

    const BadInterfaceType = new GraphQLInterfaceType({
      name: 'BadInterface',
      fields,
    });

    const BadImplementingType = new GraphQLObjectType({
      name: 'BadImplementing',
      interfaces: [BadInterfaceType],
      fields,
    });

    return new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          f: { type: BadInterfaceType },
        },
      }),
      types: [BadImplementingType, SomeObjectType],
    });
  }

  for (const type of outputTypes) {
    const typeName = inspect(type);
    it(`accepts an output type as an Interface field type: ${typeName}`, () => {
      const schema = schemaWithInterfaceField({ type });
      expectJSON(validateSchema(schema)).toDeepEqual([]);
    });
  }

  it('rejects an empty Interface field type', () => {
    // @ts-expect-error (type field must not be undefined)
    const schema = schemaWithInterfaceField({ type: undefined });
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'The type of BadImplementing.badField must be Output Type but got: undefined.',
      },
      {
        message:
          'The type of BadInterface.badField must be Output Type but got: undefined.',
      },
    ]);
  });

  for (const type of notOutputTypes) {
    const typeStr = inspect(type);
    it(`rejects a non-output type as an Interface field type: ${typeStr}`, () => {
      // @ts-expect-error
      const schema = schemaWithInterfaceField({ type });
      expectJSON(validateSchema(schema)).toDeepEqual([
        {
          message: `The type of BadImplementing.badField must be Output Type but got: ${typeStr}.`,
        },
        {
          message: `The type of BadInterface.badField must be Output Type but got: ${typeStr}.`,
        },
      ]);
    });
  }

  it('rejects a non-type value as an Interface field type', () => {
    // @ts-expect-error
    const schema = schemaWithInterfaceField({ type: Number });
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'The type of BadImplementing.badField must be Output Type but got: [function Number].',
      },
      {
        message:
          'The type of BadInterface.badField must be Output Type but got: [function Number].',
      },
      {
        message: 'Expected GraphQL named type but got: [function Number].',
      },
    ]);
  });

  it('rejects a non-output type as an Interface field type with locations', () => {
    const schema = buildSchema(`
      type Query {
        test: SomeInterface
      }

      interface SomeInterface {
        field: SomeInputObject
      }

      input SomeInputObject {
        foo: String
      }

      type SomeObject implements SomeInterface {
        field: SomeInputObject
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'The type of SomeInterface.field must be Output Type but got: SomeInputObject.',
        locations: [{ line: 7, column: 16 }],
      },
      {
        message:
          'The type of SomeObject.field must be Output Type but got: SomeInputObject.',
        locations: [{ line: 15, column: 16 }],
      },
    ]);
  });

  it('accepts an interface not implemented by at least one object', () => {
    const schema = buildSchema(`
      type Query {
        test: SomeInterface
      }

      interface SomeInterface {
        foo: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([]);
  });
});

describe('Type System: Arguments must have input types', () => {
  function schemaWithArg(argConfig: GraphQLArgumentConfig): GraphQLSchema {
    const BadObjectType = new GraphQLObjectType({
      name: 'BadObject',
      fields: {
        badField: {
          type: GraphQLString,
          args: {
            badArg: argConfig,
          },
        },
      },
    });

    return new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          f: { type: BadObjectType },
        },
      }),
      directives: [
        new GraphQLDirective({
          name: 'BadDirective',
          args: {
            badArg: argConfig,
          },
          locations: [DirectiveLocation.QUERY],
        }),
      ],
    });
  }

  for (const type of inputTypes) {
    const typeName = inspect(type);
    it(`accepts an input type as a field arg type: ${typeName}`, () => {
      const schema = schemaWithArg({ type });
      expectJSON(validateSchema(schema)).toDeepEqual([]);
    });
  }

  it('rejects an empty field arg type', () => {
    // @ts-expect-error (type field must not be undefined)
    const schema = schemaWithArg({ type: undefined });
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'The type of @BadDirective(badArg:) must be Input Type but got: undefined.',
      },
      {
        message:
          'The type of BadObject.badField(badArg:) must be Input Type but got: undefined.',
      },
    ]);
  });

  for (const type of notInputTypes) {
    const typeStr = inspect(type);
    it(`rejects a non-input type as a field arg type: ${typeStr}`, () => {
      // @ts-expect-error
      const schema = schemaWithArg({ type });
      expectJSON(validateSchema(schema)).toDeepEqual([
        {
          message: `The type of @BadDirective(badArg:) must be Input Type but got: ${typeStr}.`,
        },
        {
          message: `The type of BadObject.badField(badArg:) must be Input Type but got: ${typeStr}.`,
        },
      ]);
    });
  }

  it('rejects a non-type value as a field arg type', () => {
    // @ts-expect-error
    const schema = schemaWithArg({ type: Number });
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'The type of @BadDirective(badArg:) must be Input Type but got: [function Number].',
      },
      {
        message:
          'The type of BadObject.badField(badArg:) must be Input Type but got: [function Number].',
      },
      {
        message: 'Expected GraphQL named type but got: [function Number].',
      },
    ]);
  });

  it('rejects a required argument that is deprecated', () => {
    const schema = buildSchema(`
      directive @BadDirective(
        badArg: String! @deprecated
        optionalArg: String @deprecated
        anotherOptionalArg: String! = "" @deprecated
      ) on FIELD

      type Query {
        test(
          badArg: String! @deprecated
          optionalArg: String @deprecated
          anotherOptionalArg: String! = "" @deprecated
        ): String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Required argument @BadDirective(badArg:) cannot be deprecated.',
        locations: [
          { line: 3, column: 25 },
          { line: 3, column: 17 },
        ],
      },
      {
        message: 'Required argument Query.test(badArg:) cannot be deprecated.',
        locations: [
          { line: 10, column: 27 },
          { line: 10, column: 19 },
        ],
      },
    ]);
  });

  it('rejects a non-input type as a field arg with locations', () => {
    const schema = buildSchema(`
      type Query {
        test(arg: SomeObject): String
      }

      type SomeObject {
        foo: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'The type of Query.test(arg:) must be Input Type but got: SomeObject.',
        locations: [{ line: 3, column: 19 }],
      },
    ]);
  });
});

describe('Type System: Argument default values must be valid', () => {
  it('rejects an argument with invalid default values (SDL)', () => {
    const schema = buildSchema(`
      type Query {
        field(arg: Int = 3.14): Int
      }

      directive @bad(arg: Int = 2.718) on FIELD
    `);

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          '@bad(arg:) has invalid default value: Int cannot represent non-integer value: 2.718',
        locations: [{ line: 6, column: 33 }],
      },
      {
        message:
          'Query.field(arg:) has invalid default value: Int cannot represent non-integer value: 3.14',
        locations: [{ line: 3, column: 26 }],
      },
    ]);
  });

  it('rejects an argument with invalid default values (programmatic)', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: {
            type: GraphQLInt,
            args: {
              arg: { type: GraphQLInt, default: { value: 3.14 } },
            },
          },
        },
      }),
      directives: [
        new GraphQLDirective({
          name: 'bad',
          args: {
            arg: { type: GraphQLInt, default: { value: 2.718 } },
          },
          locations: [DirectiveLocation.FIELD],
        }),
      ],
    });

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          '@bad(arg:) has invalid default value: Int cannot represent non-integer value: 2.718',
      },
      {
        message:
          'Query.field(arg:) has invalid default value: Int cannot represent non-integer value: 3.14',
      },
    ]);
  });

  it('Attempts to offer a suggested fix if possible (programmatic)', () => {
    const Exotic = Symbol('Exotic');

    const testEnum = new GraphQLEnumType({
      name: 'TestEnum',
      values: {
        ONE: { value: 1 },
        TWO: { value: Exotic },
      },
    });

    const testInput: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'TestInput',
      fields: () => ({
        self: { type: testInput },
        string: { type: new GraphQLNonNull(new GraphQLList(GraphQLString)) },
        enum: { type: new GraphQLList(testEnum) },
      }),
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: {
            type: GraphQLInt,
            args: {
              argWithPossibleFix: {
                type: testInput,
                default: { value: { self: null, string: [1], enum: Exotic } },
              },
              argWithInvalidPossibleFix: {
                type: testInput,
                default: { value: { string: null } },
              },
              argWithoutPossibleFix: {
                type: testInput,
                default: { value: { enum: 'Exotic' } },
              },
            },
          },
        },
      }),
    });

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Query.field(argWithPossibleFix:) has invalid default value: { self: null, string: [1], enum: Symbol(Exotic) }. Did you mean: { self: null, string: ["1"], enum: ["TWO"] }?',
      },
      {
        message:
          'Query.field(argWithInvalidPossibleFix:) has invalid default value at .string: Expected value of non-null type "[String]!" not to be null.',
      },
      {
        message:
          'Query.field(argWithoutPossibleFix:) has invalid default value: Expected value of type "TestInput" to include required field "string", found: { enum: "Exotic" }.',
      },
      {
        message:
          'Query.field(argWithoutPossibleFix:) has invalid default value at .enum: Value "Exotic" does not exist in "TestEnum" enum.',
      },
    ]);
  });

  it('Attempts to offer a suggested fix if possible (SDL)', () => {
    const originalSchema = buildSchema(`
      enum TestEnum {
        ONE
        TWO
      }

      input TestInput {
        self: TestInput
        string: [String]!
        enum: [TestEnum]
      }

      type Query {
        field(
          argWithPossibleFix: TestInput
          argWithInvalidPossibleFix: TestInput
          argWithoutPossibleFix: TestInput
        ): Int
      }
    `);

    const Exotic = Symbol('Exotic');

    // workaround as we cannot inject custom internal values into enums defined in SDL
    const testEnum = new GraphQLEnumType({
      name: 'TestEnum',
      values: {
        ONE: { value: 1 },
        TWO: { value: Exotic },
      },
    });

    const testInput = assertInputObjectType(
      originalSchema.getType('TestInput'),
    );
    testInput.getFields().enum.type = new GraphQLList(testEnum);

    // workaround as we cannot inject exotic default values into arguments defined in SDL
    const QueryType = assertObjectType(originalSchema.getType('Query'));
    for (const arg of QueryType.getFields().field.args) {
      arg.type = testInput;
      switch (arg.name) {
        case 'argWithPossibleFix':
          arg.default = { value: { self: null, string: [1], enum: Exotic } };
          break;
        case 'argWithInvalidPossibleFix':
          arg.default = { value: { string: null } };
          break;
        case 'argWithoutPossibleFix':
          arg.default = { value: { enum: 'Exotic' } };
          break;
      }
    }

    expectJSON(validateSchema(originalSchema)).toDeepEqual([
      {
        message:
          'Query.field(argWithPossibleFix:) has invalid default value: { self: null, string: [1], enum: Symbol(Exotic) }. Did you mean: { self: null, string: ["1"], enum: ["TWO"] }?',
      },
      {
        message:
          'Query.field(argWithInvalidPossibleFix:) has invalid default value at .string: Expected value of non-null type "[String]!" not to be null.',
      },
      {
        message:
          'Query.field(argWithoutPossibleFix:) has invalid default value: Expected value of type "TestInput" to include required field "string", found: { enum: "Exotic" }.',
      },
      {
        message:
          'Query.field(argWithoutPossibleFix:) has invalid default value at .enum: Value "Exotic" does not exist in "TestEnum" enum.',
      },
    ]);
  });
});

describe('Type System: Input Object fields must have input types', () => {
  function schemaWithInputField(
    inputFieldConfig: GraphQLInputFieldConfig,
  ): GraphQLSchema {
    const BadInputObjectType = new GraphQLInputObjectType({
      name: 'BadInputObject',
      fields: {
        badField: inputFieldConfig,
      },
    });

    return new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          f: {
            type: GraphQLString,
            args: {
              badArg: { type: BadInputObjectType },
            },
          },
        },
      }),
    });
  }

  for (const type of inputTypes) {
    const typeName = inspect(type);
    it(`accepts an input type as an input field type: ${typeName}`, () => {
      const schema = schemaWithInputField({ type });
      expectJSON(validateSchema(schema)).toDeepEqual([]);
    });
  }

  it('rejects an empty input field type', () => {
    // @ts-expect-error (type field must not be undefined)
    const schema = schemaWithInputField({ type: undefined });
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'The type of BadInputObject.badField must be Input Type but got: undefined.',
      },
    ]);
  });

  for (const type of notInputTypes) {
    const typeStr = inspect(type);
    it(`rejects a non-input type as an input field type: ${typeStr}`, () => {
      // @ts-expect-error
      const schema = schemaWithInputField({ type });
      expectJSON(validateSchema(schema)).toDeepEqual([
        {
          message: `The type of BadInputObject.badField must be Input Type but got: ${typeStr}.`,
        },
      ]);
    });
  }

  it('rejects a non-type value as an input field type', () => {
    // @ts-expect-error
    const schema = schemaWithInputField({ type: Number });
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'The type of BadInputObject.badField must be Input Type but got: [function Number].',
      },
      {
        message: 'Expected GraphQL named type but got: [function Number].',
      },
    ]);
  });

  it('rejects a non-input type as an input object field with locations', () => {
    const schema = buildSchema(`
      type Query {
        test(arg: SomeInputObject): String
      }

      input SomeInputObject {
        foo: SomeObject
      }

      type SomeObject {
        bar: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'The type of SomeInputObject.foo must be Input Type but got: SomeObject.',
        locations: [{ line: 7, column: 14 }],
      },
    ]);
  });
});

describe('Type System: Input Object field default values must be valid', () => {
  it('rejects an Input Object field with invalid default values (SDL)', () => {
    const schema = buildSchema(`
    type Query {
      field(arg: SomeInputObject): Int
    }

    input SomeInputObject {
      field: Int = 3.14
    }
  `);

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'SomeInputObject.field has invalid default value: Int cannot represent non-integer value: 3.14',
        locations: [{ line: 7, column: 20 }],
      },
    ]);
  });

  it('rejects an Input Object field with invalid default values (programmatic)', () => {
    const someInputObject = new GraphQLInputObjectType({
      name: 'SomeInputObject',
      fields: {
        field: {
          type: GraphQLInt,
          default: { value: 3.14 },
        },
      },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: {
            type: GraphQLInt,
            args: {
              arg: { type: someInputObject },
            },
          },
        },
      }),
    });

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'SomeInputObject.field has invalid default value: Int cannot represent non-integer value: 3.14',
      },
    ]);
  });
});

describe('Type System: OneOf Input Object fields must be nullable', () => {
  it('rejects non-nullable fields', () => {
    const schema = buildSchema(`
      type Query {
        test(arg: SomeInputObject): String
      }

      input SomeInputObject @oneOf {
        a: String
        b: String!
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message: 'OneOf input field SomeInputObject.b must be nullable.',
        locations: [{ line: 8, column: 12 }],
      },
    ]);
  });

  it('rejects fields with default values', () => {
    const schema = buildSchema(`
      type Query {
        test(arg: SomeInputObject): String
      }

      input SomeInputObject @oneOf {
        a: String
        b: String = "foo"
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'OneOf input field SomeInputObject.b cannot have a default value.',
        locations: [{ line: 8, column: 9 }],
      },
    ]);
  });
});

describe('Objects must adhere to Interface they implement', () => {
  it('accepts an Object which implements an Interface', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      interface AnotherInterface {
        field(input: String): String
      }

      type AnotherObject implements AnotherInterface {
        field(input: String): String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([]);
  });

  it('accepts an Object which implements an Interface along with more fields', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      interface AnotherInterface {
        field(input: String): String
      }

      type AnotherObject implements AnotherInterface {
        field(input: String): String
        anotherField: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([]);
  });

  it('accepts an Object which implements an Interface field along with additional optional arguments', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      interface AnotherInterface {
        field(input: String): String
      }

      type AnotherObject implements AnotherInterface {
        field(input: String, anotherInput: String): String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([]);
  });

  it('rejects an Object missing an Interface field', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      interface AnotherInterface {
        field(input: String): String
      }

      type AnotherObject implements AnotherInterface {
        anotherField: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Interface field AnotherInterface.field expected but AnotherObject does not provide it.',
        locations: [
          { line: 7, column: 9 },
          { line: 10, column: 7 },
        ],
      },
    ]);
  });

  it('rejects an Object with an incorrectly typed Interface field', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      interface AnotherInterface {
        field(input: String): String
      }

      type AnotherObject implements AnotherInterface {
        field(input: String): Int
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Interface field AnotherInterface.field expects type String but AnotherObject.field is type Int.',
        locations: [
          { line: 7, column: 31 },
          { line: 11, column: 31 },
        ],
      },
    ]);
  });

  it('rejects an Object with a differently typed Interface field', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      type A { foo: String }
      type B { foo: String }

      interface AnotherInterface {
        field: A
      }

      type AnotherObject implements AnotherInterface {
        field: B
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Interface field AnotherInterface.field expects type A but AnotherObject.field is type B.',
        locations: [
          { line: 10, column: 16 },
          { line: 14, column: 16 },
        ],
      },
    ]);
  });

  it('accepts an Object with a subtyped Interface field (interface)', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      interface AnotherInterface {
        field: AnotherInterface
      }

      type AnotherObject implements AnotherInterface {
        field: AnotherObject
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([]);
  });

  it('accepts an Object with a subtyped Interface field (union)', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      type SomeObject {
        field: String
      }

      union SomeUnionType = SomeObject

      interface AnotherInterface {
        field: SomeUnionType
      }

      type AnotherObject implements AnotherInterface {
        field: SomeObject
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([]);
  });

  it('rejects an Object missing an Interface argument', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      interface AnotherInterface {
        field(input: String): String
      }

      type AnotherObject implements AnotherInterface {
        field: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Interface field argument AnotherInterface.field(input:) expected but AnotherObject.field does not provide it.',
        locations: [
          { line: 7, column: 15 },
          { line: 11, column: 9 },
        ],
      },
    ]);
  });

  it('rejects an Object with an incorrectly typed Interface argument', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      interface AnotherInterface {
        field(input: String): String
      }

      type AnotherObject implements AnotherInterface {
        field(input: Int): String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Interface field argument AnotherInterface.field(input:) expects type String but AnotherObject.field(input:) is type Int.',
        locations: [
          { line: 7, column: 22 },
          { line: 11, column: 22 },
        ],
      },
    ]);
  });

  it('rejects an Object with both an incorrectly typed field and argument', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      interface AnotherInterface {
        field(input: String): String
      }

      type AnotherObject implements AnotherInterface {
        field(input: Int): Int
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Interface field AnotherInterface.field expects type String but AnotherObject.field is type Int.',
        locations: [
          { line: 7, column: 31 },
          { line: 11, column: 28 },
        ],
      },
      {
        message:
          'Interface field argument AnotherInterface.field(input:) expects type String but AnotherObject.field(input:) is type Int.',
        locations: [
          { line: 7, column: 22 },
          { line: 11, column: 22 },
        ],
      },
    ]);
  });

  it('rejects an Object which implements an Interface field along with additional required arguments', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      interface AnotherInterface {
        field(baseArg: String): String
      }

      type AnotherObject implements AnotherInterface {
        field(
          baseArg: String,
          requiredArg: String!
          optionalArg1: String,
          optionalArg2: String = "",
        ): String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Argument "AnotherObject.field(requiredArg:)" must not be required type "String!" if not provided by the Interface field "AnotherInterface.field".',
        locations: [
          { line: 13, column: 11 },
          { line: 7, column: 9 },
        ],
      },
    ]);
  });

  it('accepts an Object with an equivalently wrapped Interface field type', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      interface AnotherInterface {
        field: [String]!
      }

      type AnotherObject implements AnotherInterface {
        field: [String]!
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([]);
  });

  it('rejects an Object with a non-list Interface field list type', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      interface AnotherInterface {
        field: [String]
      }

      type AnotherObject implements AnotherInterface {
        field: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Interface field AnotherInterface.field expects type [String] but AnotherObject.field is type String.',
        locations: [
          { line: 7, column: 16 },
          { line: 11, column: 16 },
        ],
      },
    ]);
  });

  it('rejects an Object with a list Interface field non-list type', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      interface AnotherInterface {
        field: String
      }

      type AnotherObject implements AnotherInterface {
        field: [String]
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Interface field AnotherInterface.field expects type String but AnotherObject.field is type [String].',
        locations: [
          { line: 7, column: 16 },
          { line: 11, column: 16 },
        ],
      },
    ]);
  });

  it('accepts an Object with a subset non-null Interface field type', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      interface AnotherInterface {
        field: String
      }

      type AnotherObject implements AnotherInterface {
        field: String!
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([]);
  });

  it('rejects an Object with a superset nullable Interface field type', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      interface AnotherInterface {
        field: String!
      }

      type AnotherObject implements AnotherInterface {
        field: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Interface field AnotherInterface.field expects type String! but AnotherObject.field is type String.',
        locations: [
          { line: 7, column: 16 },
          { line: 11, column: 16 },
        ],
      },
    ]);
  });

  it('rejects an Object missing a transitive interface', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      interface SuperInterface {
        field: String!
      }

      interface AnotherInterface implements SuperInterface {
        field: String!
      }

      type AnotherObject implements AnotherInterface {
        field: String!
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Type AnotherObject must implement SuperInterface because it is implemented by AnotherInterface.',
        locations: [
          { line: 10, column: 45 },
          { line: 14, column: 37 },
        ],
      },
    ]);
  });
});

describe('Interfaces must adhere to Interface they implement', () => {
  it('accepts an Interface which implements an Interface', () => {
    const schema = buildSchema(`
      type Query {
        test: ChildInterface
      }

      interface ParentInterface {
        field(input: String): String
      }

      interface ChildInterface implements ParentInterface {
        field(input: String): String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([]);
  });

  it('accepts an Interface which implements an Interface along with more fields', () => {
    const schema = buildSchema(`
      type Query {
        test: ChildInterface
      }

      interface ParentInterface {
        field(input: String): String
      }

      interface ChildInterface implements ParentInterface {
        field(input: String): String
        anotherField: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([]);
  });

  it('accepts an Interface which implements an Interface field along with additional optional arguments', () => {
    const schema = buildSchema(`
      type Query {
        test: ChildInterface
      }

      interface ParentInterface {
        field(input: String): String
      }

      interface ChildInterface implements ParentInterface {
        field(input: String, anotherInput: String): String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([]);
  });

  it('rejects an Interface missing an Interface field', () => {
    const schema = buildSchema(`
      type Query {
        test: ChildInterface
      }

      interface ParentInterface {
        field(input: String): String
      }

      interface ChildInterface implements ParentInterface {
        anotherField: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Interface field ParentInterface.field expected but ChildInterface does not provide it.',
        locations: [
          { line: 7, column: 9 },
          { line: 10, column: 7 },
        ],
      },
    ]);
  });

  it('rejects an Interface with an incorrectly typed Interface field', () => {
    const schema = buildSchema(`
      type Query {
        test: ChildInterface
      }

      interface ParentInterface {
        field(input: String): String
      }

      interface ChildInterface implements ParentInterface {
        field(input: String): Int
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Interface field ParentInterface.field expects type String but ChildInterface.field is type Int.',
        locations: [
          { line: 7, column: 31 },
          { line: 11, column: 31 },
        ],
      },
    ]);
  });

  it('rejects an Interface with a differently typed Interface field', () => {
    const schema = buildSchema(`
      type Query {
        test: ChildInterface
      }

      type A { foo: String }
      type B { foo: String }

      interface ParentInterface {
        field: A
      }

      interface ChildInterface implements ParentInterface {
        field: B
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Interface field ParentInterface.field expects type A but ChildInterface.field is type B.',
        locations: [
          { line: 10, column: 16 },
          { line: 14, column: 16 },
        ],
      },
    ]);
  });

  it('accepts an Interface with a subtyped Interface field (interface)', () => {
    const schema = buildSchema(`
      type Query {
        test: ChildInterface
      }

      interface ParentInterface {
        field: ParentInterface
      }

      interface ChildInterface implements ParentInterface {
        field: ChildInterface
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([]);
  });

  it('accepts an Interface with a subtyped Interface field (union)', () => {
    const schema = buildSchema(`
      type Query {
        test: ChildInterface
      }

      type SomeObject {
        field: String
      }

      union SomeUnionType = SomeObject

      interface ParentInterface {
        field: SomeUnionType
      }

      interface ChildInterface implements ParentInterface {
        field: SomeObject
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([]);
  });

  it('rejects an Interface implementing a non-Interface type', () => {
    const schema = buildSchema(`
      type Query {
        field: String
      }

      input SomeInputObject {
        field: String
      }

      interface BadInterface implements SomeInputObject {
        field: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Type BadInterface must only implement Interface types, it cannot implement SomeInputObject.',
        locations: [{ line: 10, column: 41 }],
      },
    ]);
  });

  it('rejects an Interface missing an Interface argument', () => {
    const schema = buildSchema(`
      type Query {
        test: ChildInterface
      }

      interface ParentInterface {
        field(input: String): String
      }

      interface ChildInterface implements ParentInterface {
        field: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Interface field argument ParentInterface.field(input:) expected but ChildInterface.field does not provide it.',
        locations: [
          { line: 7, column: 15 },
          { line: 11, column: 9 },
        ],
      },
    ]);
  });

  it('rejects an Interface with an incorrectly typed Interface argument', () => {
    const schema = buildSchema(`
      type Query {
        test: ChildInterface
      }

      interface ParentInterface {
        field(input: String): String
      }

      interface ChildInterface implements ParentInterface {
        field(input: Int): String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Interface field argument ParentInterface.field(input:) expects type String but ChildInterface.field(input:) is type Int.',
        locations: [
          { line: 7, column: 22 },
          { line: 11, column: 22 },
        ],
      },
    ]);
  });

  it('rejects an Interface with both an incorrectly typed field and argument', () => {
    const schema = buildSchema(`
      type Query {
        test: ChildInterface
      }

      interface ParentInterface {
        field(input: String): String
      }

      interface ChildInterface implements ParentInterface {
        field(input: Int): Int
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Interface field ParentInterface.field expects type String but ChildInterface.field is type Int.',
        locations: [
          { line: 7, column: 31 },
          { line: 11, column: 28 },
        ],
      },
      {
        message:
          'Interface field argument ParentInterface.field(input:) expects type String but ChildInterface.field(input:) is type Int.',
        locations: [
          { line: 7, column: 22 },
          { line: 11, column: 22 },
        ],
      },
    ]);
  });

  it('rejects an Interface which implements an Interface field along with additional required arguments', () => {
    const schema = buildSchema(`
      type Query {
        test: ChildInterface
      }

      interface ParentInterface {
        field(baseArg: String): String
      }

      interface ChildInterface implements ParentInterface {
        field(
          baseArg: String,
          requiredArg: String!
          optionalArg1: String,
          optionalArg2: String = "",
        ): String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Argument "ChildInterface.field(requiredArg:)" must not be required type "String!" if not provided by the Interface field "ParentInterface.field".',
        locations: [
          { line: 13, column: 11 },
          { line: 7, column: 9 },
        ],
      },
    ]);
  });

  it('accepts an Interface with an equivalently wrapped Interface field type', () => {
    const schema = buildSchema(`
      type Query {
        test: ChildInterface
      }

      interface ParentInterface {
        field: [String]!
      }

      interface ChildInterface implements ParentInterface {
        field: [String]!
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([]);
  });

  it('rejects an Interface with a non-list Interface field list type', () => {
    const schema = buildSchema(`
      type Query {
        test: ChildInterface
      }

      interface ParentInterface {
        field: [String]
      }

      interface ChildInterface implements ParentInterface {
        field: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Interface field ParentInterface.field expects type [String] but ChildInterface.field is type String.',
        locations: [
          { line: 7, column: 16 },
          { line: 11, column: 16 },
        ],
      },
    ]);
  });

  it('rejects an Interface with a list Interface field non-list type', () => {
    const schema = buildSchema(`
      type Query {
        test: ChildInterface
      }

      interface ParentInterface {
        field: String
      }

      interface ChildInterface implements ParentInterface {
        field: [String]
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Interface field ParentInterface.field expects type String but ChildInterface.field is type [String].',
        locations: [
          { line: 7, column: 16 },
          { line: 11, column: 16 },
        ],
      },
    ]);
  });

  it('accepts an Interface with a subset non-null Interface field type', () => {
    const schema = buildSchema(`
      type Query {
        test: ChildInterface
      }

      interface ParentInterface {
        field: String
      }

      interface ChildInterface implements ParentInterface {
        field: String!
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([]);
  });

  it('rejects an Interface with a superset nullable Interface field type', () => {
    const schema = buildSchema(`
      type Query {
        test: ChildInterface
      }

      interface ParentInterface {
        field: String!
      }

      interface ChildInterface implements ParentInterface {
        field: String
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Interface field ParentInterface.field expects type String! but ChildInterface.field is type String.',
        locations: [
          { line: 7, column: 16 },
          { line: 11, column: 16 },
        ],
      },
    ]);
  });

  it('rejects an Object missing a transitive interface', () => {
    const schema = buildSchema(`
      type Query {
        test: ChildInterface
      }

      interface SuperInterface {
        field: String!
      }

      interface ParentInterface implements SuperInterface {
        field: String!
      }

      interface ChildInterface implements ParentInterface {
        field: String!
      }
    `);
    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Type ChildInterface must implement SuperInterface because it is implemented by ParentInterface.',
        locations: [
          { line: 10, column: 44 },
          { line: 14, column: 43 },
        ],
      },
    ]);
  });

  it('rejects a self reference interface', () => {
    const schema = buildSchema(`
      type Query {
        test: FooInterface
      }

      interface FooInterface implements FooInterface {
        field: String
      }
    `);

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Type FooInterface cannot implement itself because it would create a circular reference.',
        locations: [{ line: 6, column: 41 }],
      },
    ]);
  });

  it('rejects a circular Interface implementation', () => {
    const schema = buildSchema(`
      type Query {
        test: FooInterface
      }

      interface FooInterface implements BarInterface {
        field: String
      }

      interface BarInterface implements FooInterface {
        field: String
      }
    `);

    expectJSON(validateSchema(schema)).toDeepEqual([
      {
        message:
          'Type FooInterface cannot implement BarInterface because it would create a circular reference.',
        locations: [
          { line: 10, column: 41 },
          { line: 6, column: 41 },
        ],
      },
      {
        message:
          'Type BarInterface cannot implement FooInterface because it would create a circular reference.',
        locations: [
          { line: 6, column: 41 },
          { line: 10, column: 41 },
        ],
      },
    ]);
  });
});

describe('assertValidSchema', () => {
  it('does not throw on valid schemas', () => {
    const schema = buildSchema(`
      type Query {
        foo: String
      }
    `);
    expect(() => assertValidSchema(schema)).to.not.throw();
  });

  it('combines multiple errors', () => {
    const schema = buildSchema('type SomeType');
    expect(() => assertValidSchema(schema)).to.throw(dedent`
      Query root type must be provided.

      Type SomeType must define one or more fields.`);
  });
});
