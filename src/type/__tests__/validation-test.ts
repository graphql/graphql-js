import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedent } from '../../__testUtils__/dedent';
import { expectJSON } from '../../__testUtils__/expectJSON';

import { inspect } from '../../jsutils/inspect';

import { DirectiveLocation } from '../../language/directiveLocation';
import { parse } from '../../language/parser';

import { buildSchema } from '../../utilities/buildASTSchema';
import { extendSchema } from '../../utilities/extendSchema';

import type {
  GraphQLArgumentConfig,
  GraphQLFieldConfig,
  GraphQLInputFieldConfig,
  GraphQLInputType,
  GraphQLNamedType,
  GraphQLOutputType,
} from '../definition';
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
  GraphQLUnionType,
} from '../definition';
import { assertDirective, GraphQLDirective } from '../directives';
import { GraphQLString } from '../scalars';
import { GraphQLSchema } from '../schema';
import { assertValidSchema, validateSchema } from '../validate';

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

  it('rejects a schema extended with invalid root types', () => {
    let schema = buildSchema(`
      input SomeInputObject {
        test: String
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
          mutation: SomeInputObject
        }
      `),
    );

    schema = extendSchema(
      schema,
      parse(`
        extend schema {
          subscription: SomeInputObject
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
          'Mutation root type must be Object type if provided, it cannot be SomeInputObject.',
        locations: [{ line: 3, column: 21 }],
      },
      {
        message:
          'Subscription root type must be Object type if provided, it cannot be SomeInputObject.',
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
          'Cannot reference Input Object "SomeInputObject" within itself through a series of non-null fields: "nonNullSelf".',
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
          'Cannot reference Input Object "SomeInputObject" within itself through a series of non-null fields: "startLoop.nextInLoop.closeLoop".',
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
          'Cannot reference Input Object "SomeInputObject" within itself through a series of non-null fields: "startLoop.closeLoop".',
        locations: [
          { line: 7, column: 9 },
          { line: 11, column: 9 },
        ],
      },
      {
        message:
          'Cannot reference Input Object "AnotherInputObject" within itself through a series of non-null fields: "startSecondLoop.closeSecondLoop".',
        locations: [
          { line: 12, column: 9 },
          { line: 16, column: 9 },
        ],
      },
      {
        message:
          'Cannot reference Input Object "YetAnotherInputObject" within itself through a series of non-null fields: "nonNullSelf".',
        locations: [{ line: 17, column: 9 }],
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

  it('rejects an Input Object type with required argument that is deprecated', () => {
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
          'Object field AnotherObject.field includes required argument requiredArg that is missing from the Interface field AnotherInterface.field.',
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
          'Object field ChildInterface.field includes required argument requiredArg that is missing from the Interface field ParentInterface.field.',
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
