/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import inspect from '../../jsutils/inspect';
import {
  type GraphQLNamedType,
  type GraphQLInputType,
  type GraphQLOutputType,
  GraphQLSchema,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
} from '../../';
import { parse } from '../../language/parser';
import { validateSchema } from '../validate';
import { buildSchema } from '../../utilities/buildASTSchema';
import { extendSchema } from '../../utilities/extendSchema';

const SomeScalarType = new GraphQLScalarType({
  name: 'SomeScalar',
  serialize() {},
});

const SomeInterfaceType = new GraphQLInterfaceType({
  name: 'SomeInterface',
  fields: () => ({ f: { type: SomeObjectType } }),
});

const SomeObjectType = new GraphQLObjectType({
  name: 'SomeObject',
  fields: () => ({ f: { type: SomeObjectType } }),
  interfaces: [SomeInterfaceType],
});

const SomeUnionType = new GraphQLUnionType({
  name: 'SomeUnion',
  types: [SomeObjectType],
});

const SomeEnumType = new GraphQLEnumType({
  name: 'SomeEnum',
  values: {
    ONLY: {},
  },
});

const SomeInputObjectType = new GraphQLInputObjectType({
  name: 'SomeInputObject',
  fields: {
    val: { type: GraphQLString, defaultValue: 'hello' },
  },
});

function withModifiers<T: GraphQLNamedType>(types: Array<T>): Array<*> {
  return [
    ...types,
    ...types.map(type => GraphQLList(type)),
    ...types.map(type => GraphQLNonNull(type)),
    ...types.map(type => GraphQLNonNull(GraphQLList(type))),
  ];
}

const outputTypes: Array<GraphQLOutputType> = withModifiers([
  GraphQLString,
  SomeScalarType,
  SomeEnumType,
  SomeObjectType,
  SomeUnionType,
  SomeInterfaceType,
]);

const notOutputTypes: Array<GraphQLInputType> = withModifiers([
  SomeInputObjectType,
]);

const inputTypes: Array<GraphQLInputType> = withModifiers([
  GraphQLString,
  SomeScalarType,
  SomeEnumType,
  SomeInputObjectType,
]);

const notInputTypes: Array<GraphQLOutputType> = withModifiers([
  SomeObjectType,
  SomeUnionType,
  SomeInterfaceType,
]);

function schemaWithFieldType(type) {
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: { f: { type } },
    }),
    types: [type],
  });
}

describe('Type System: A Schema must have Object root types', () => {
  it('accepts a Schema whose query type is an object type', () => {
    const schema = buildSchema(`
      type Query {
        test: String
      }
    `);
    expect(validateSchema(schema)).to.deep.equal([]);

    const schemaWithDef = buildSchema(`
      schema {
        query: QueryRoot
      }

      type QueryRoot {
        test: String
      }
    `);
    expect(validateSchema(schemaWithDef)).to.deep.equal([]);
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
    expect(validateSchema(schema)).to.deep.equal([]);

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
    expect(validateSchema(schemaWithDef)).to.deep.equal([]);
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
    expect(validateSchema(schema)).to.deep.equal([]);

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
    expect(validateSchema(schemaWithDef)).to.deep.equal([]);
  });

  it('rejects a Schema without a query type', () => {
    const schema = buildSchema(`
      type Mutation {
        test: String
      }
    `);
    expect(validateSchema(schema)).to.deep.equal([
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
    expect(validateSchema(schemaWithDef)).to.deep.equal([
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
    expect(validateSchema(schema)).to.deep.equal([
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
    expect(validateSchema(schemaWithDef)).to.deep.equal([
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
    expect(validateSchema(schema)).to.deep.equal([
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
    expect(validateSchema(schemaWithDef)).to.deep.equal([
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
    expect(validateSchema(schema)).to.deep.equal([
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
    expect(validateSchema(schemaWithDef)).to.deep.equal([
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

    expect(validateSchema(schema)).to.deep.equal([
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

  it('rejects a Schema whose directives are incorrectly typed', () => {
    const schema = new GraphQLSchema({
      query: SomeObjectType,
      // $DisableFlowOnNegativeTest
      directives: ['somedirective'],
    });
    expect(validateSchema(schema)).to.deep.equal([
      {
        message: 'Expected directive but got: "somedirective".',
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
    expect(validateSchema(schema)).to.deep.equal([]);
  });

  it('rejects an Object type with missing fields', () => {
    const schema = buildSchema(`
      type Query {
        test: IncompleteObject
      }

      type IncompleteObject
    `);
    expect(validateSchema(schema)).to.deep.equal([
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
    expect(validateSchema(manualSchema)).to.deep.equal([
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
    expect(validateSchema(manualSchema2)).to.deep.equal([
      {
        message: 'Type IncompleteObject must define one or more fields.',
      },
    ]);
  });

  it('rejects an Object type with incorrectly named fields', () => {
    const schema = schemaWithFieldType(
      new GraphQLObjectType({
        name: 'SomeObject',
        fields: { 'bad-name-with-dashes': { type: GraphQLString } },
      }),
    );
    expect(validateSchema(schema)).to.deep.equal([
      {
        message:
          'Names must match /^[_a-zA-Z][_a-zA-Z0-9]*$/ but "bad-name-with-dashes" does not.',
      },
    ]);
  });

  it('accepts an Object type with explicitly allowed legacy named fields', () => {
    const schemaBad = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: { __badName: { type: GraphQLString } },
      }),
    });
    const schemaOk = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: { __badName: { type: GraphQLString } },
      }),
      allowedLegacyNames: ['__badName'],
    });
    expect(validateSchema(schemaBad)).to.deep.equal([
      {
        message:
          'Name "__badName" must not begin with "__", which is reserved by GraphQL introspection.',
      },
    ]);
    expect(validateSchema(schemaOk)).to.deep.equal([]);
  });

  it('throws with bad value for explicitly allowed legacy names', () => {
    expect(
      () =>
        new GraphQLSchema({
          query: new GraphQLObjectType({
            name: 'Query',
            fields: { __badName: { type: GraphQLString } },
          }),
          // $DisableFlowOnNegativeTest
          allowedLegacyNames: true,
        }),
    ).to.throw('"allowedLegacyNames" must be Array if provided but got: true.');
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
    expect(validateSchema(schema)).to.deep.equal([]);
  });

  it('rejects field arg with invalid names', () => {
    const QueryType = new GraphQLObjectType({
      name: 'SomeObject',
      fields: {
        badField: {
          type: GraphQLString,
          args: {
            'bad-name-with-dashes': { type: GraphQLString },
          },
        },
      },
    });
    const schema = new GraphQLSchema({ query: QueryType });
    expect(validateSchema(schema)).to.deep.equal([
      {
        message:
          'Names must match /^[_a-zA-Z][_a-zA-Z0-9]*$/ but "bad-name-with-dashes" does not.',
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
    expect(validateSchema(schema)).to.deep.equal([]);
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

    expect(validateSchema(schema)).to.deep.equal([
      {
        message: 'Union type BadUnion must define one or more member types.',
        locations: [{ line: 6, column: 7 }, { line: 4, column: 9 }],
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

    expect(validateSchema(schema)).to.deep.equal([
      {
        message: 'Union type BadUnion can only include type TypeA once.',
        locations: [{ line: 15, column: 11 }, { line: 17, column: 11 }],
      },
    ]);

    schema = extendSchema(schema, parse('extend union BadUnion = TypeB'));

    expect(validateSchema(schema)).to.deep.equal([
      {
        message: 'Union type BadUnion can only include type TypeA once.',
        locations: [{ line: 15, column: 11 }, { line: 17, column: 11 }],
      },
      {
        message: 'Union type BadUnion can only include type TypeB once.',
        locations: [{ line: 16, column: 11 }, { line: 1, column: 25 }],
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

    expect(validateSchema(schema)).to.deep.equal([
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
        // $DisableFlowOnNegativeTest
        types: [memberType],
      });
      const badSchema = schemaWithFieldType(badUnion);
      expect(validateSchema(badSchema)).to.deep.equal([
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
    expect(validateSchema(schema)).to.deep.equal([]);
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

    expect(validateSchema(schema)).to.deep.equal([
      {
        message:
          'Input Object type SomeInputObject must define one or more fields.',
        locations: [{ line: 6, column: 7 }, { line: 4, column: 9 }],
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
    expect(validateSchema(schema)).to.deep.equal([
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

    expect(validateSchema(schema)).to.deep.equal([
      {
        message: 'Enum type SomeEnum must define one or more values.',
        locations: [{ line: 6, column: 7 }, { line: 4, column: 9 }],
      },
    ]);
  });

  it('rejects an Enum type with incorrectly named values', () => {
    function schemaWithEnum(name) {
      return schemaWithFieldType(
        new GraphQLEnumType({
          name: 'SomeEnum',
          values: {
            [name]: {},
          },
        }),
      );
    }

    const schema1 = schemaWithEnum('#value');
    expect(validateSchema(schema1)).to.deep.equal([
      {
        message:
          'Names must match /^[_a-zA-Z][_a-zA-Z0-9]*$/ but "#value" does not.',
      },
    ]);

    const schema2 = schemaWithEnum('1value');
    expect(validateSchema(schema2)).to.deep.equal([
      {
        message:
          'Names must match /^[_a-zA-Z][_a-zA-Z0-9]*$/ but "1value" does not.',
      },
    ]);

    const schema3 = schemaWithEnum('KEBAB-CASE');
    expect(validateSchema(schema3)).to.deep.equal([
      {
        message:
          'Names must match /^[_a-zA-Z][_a-zA-Z0-9]*$/ but "KEBAB-CASE" does not.',
      },
    ]);

    const schema4 = schemaWithEnum('true');
    expect(validateSchema(schema4)).to.deep.equal([
      { message: 'Enum type SomeEnum cannot include value: true.' },
    ]);

    const schema5 = schemaWithEnum('false');
    expect(validateSchema(schema5)).to.deep.equal([
      { message: 'Enum type SomeEnum cannot include value: false.' },
    ]);

    const schema6 = schemaWithEnum('null');
    expect(validateSchema(schema6)).to.deep.equal([
      { message: 'Enum type SomeEnum cannot include value: null.' },
    ]);
  });
});

describe('Type System: Object fields must have output types', () => {
  function schemaWithObjectFieldOfType(fieldType: GraphQLOutputType) {
    const BadObjectType = new GraphQLObjectType({
      name: 'BadObject',
      fields: {
        badField: { type: fieldType },
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
      const schema = schemaWithObjectFieldOfType(type);
      expect(validateSchema(schema)).to.deep.equal([]);
    });
  }

  it('rejects an empty Object field type', () => {
    // $DisableFlowOnNegativeTest
    const schema = schemaWithObjectFieldOfType(undefined);
    expect(validateSchema(schema)).to.deep.equal([
      {
        message:
          'The type of BadObject.badField must be Output Type but got: undefined.',
      },
    ]);
  });

  for (const type of notOutputTypes) {
    const typeStr = inspect(type);
    it(`rejects a non-output type as an Object field type: ${typeStr}`, () => {
      // $DisableFlowOnNegativeTest
      const schema = schemaWithObjectFieldOfType(type);
      expect(validateSchema(schema)).to.deep.equal([
        {
          message: `The type of BadObject.badField must be Output Type but got: ${typeStr}.`,
        },
      ]);
    });
  }

  it('rejects a non-type value as an Object field type', () => {
    // $DisableFlowOnNegativeTest
    const schema = schemaWithObjectFieldOfType(Number);
    expect(validateSchema(schema)).to.deep.equal([
      {
        message: `The type of BadObject.badField must be Output Type but got: [function Number].`,
      },
      {
        message: `Expected GraphQL named type but got: [function Number].`,
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
    expect(validateSchema(schema)).to.deep.equal([
      {
        message:
          'The type of Query.field must be Output Type but got: [SomeInputObject].',
        locations: [{ line: 3, column: 16 }],
      },
    ]);
  });
});

describe('Type System: Objects can only implement unique interfaces', () => {
  it('rejects an Object implementing a non-type values', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'BadObject',
        // $DisableFlowOnNegativeTest
        interfaces: [undefined],
        fields: { f: { type: GraphQLString } },
      }),
    });

    expect(validateSchema(schema)).to.deep.equal([
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
    expect(validateSchema(schema)).to.deep.equal([
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
    expect(validateSchema(schema)).to.deep.equal([
      {
        message: 'Type AnotherObject can only implement AnotherInterface once.',
        locations: [{ line: 10, column: 37 }, { line: 10, column: 56 }],
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
    expect(validateSchema(extendedSchema)).to.deep.equal([
      {
        message: 'Type AnotherObject can only implement AnotherInterface once.',
        locations: [{ line: 10, column: 37 }, { line: 1, column: 38 }],
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
    expect(validateSchema(extendedSchema)).to.deep.equal([
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
    expect(validateSchema(extendedSchema)).to.deep.equal([
      {
        message:
          'Interface field argument AnotherInterface.newField(test:) expected but AnotherObject.newField does not provide it.',
        locations: [{ line: 3, column: 20 }, { line: 7, column: 11 }],
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
    expect(validateSchema(extendedSchema)).to.deep.equal([
      {
        message:
          'Interface field AnotherInterface.newInterfaceField expects type NewInterface but AnotherObject.newInterfaceField is type MismatchingInterface.',
        locations: [{ line: 3, column: 30 }, { line: 15, column: 30 }],
      },
    ]);
  });
});

describe('Type System: Interface fields must have output types', () => {
  function schemaWithInterfaceFieldOfType(fieldType: GraphQLOutputType) {
    const BadInterfaceType = new GraphQLInterfaceType({
      name: 'BadInterface',
      fields: {
        badField: { type: fieldType },
      },
    });

    const BadImplementingType = new GraphQLObjectType({
      name: 'BadImplementing',
      interfaces: [BadInterfaceType],
      fields: {
        badField: { type: fieldType },
      },
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
      const schema = schemaWithInterfaceFieldOfType(type);
      expect(validateSchema(schema)).to.deep.equal([]);
    });
  }

  it('rejects an empty Interface field type', () => {
    // $DisableFlowOnNegativeTest
    const schema = schemaWithInterfaceFieldOfType(undefined);
    expect(validateSchema(schema)).to.deep.equal([
      {
        message:
          'The type of BadInterface.badField must be Output Type but got: undefined.',
      },
      {
        message:
          'The type of BadImplementing.badField must be Output Type but got: undefined.',
      },
    ]);
  });

  for (const type of notOutputTypes) {
    const typeStr = inspect(type);
    it(`rejects a non-output type as an Interface field type: ${typeStr}`, () => {
      // $DisableFlowOnNegativeTest
      const schema = schemaWithInterfaceFieldOfType(type);
      expect(validateSchema(schema)).to.deep.equal([
        {
          message: `The type of BadInterface.badField must be Output Type but got: ${typeStr}.`,
        },
        {
          message: `The type of BadImplementing.badField must be Output Type but got: ${typeStr}.`,
        },
      ]);
    });
  }

  it('rejects a non-type value as an Interface field type', () => {
    // $DisableFlowOnNegativeTest
    const schema = schemaWithInterfaceFieldOfType(Number);
    expect(validateSchema(schema)).to.deep.equal([
      {
        message: `The type of BadInterface.badField must be Output Type but got: [function Number].`,
      },
      {
        message: `Expected GraphQL named type but got: [function Number].`,
      },
      {
        message: `The type of BadImplementing.badField must be Output Type but got: [function Number].`,
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
    expect(validateSchema(schema)).to.deep.equal([
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
    expect(validateSchema(schema)).to.deep.equal([]);
  });
});

describe('Type System: Field arguments must have input types', () => {
  function schemaWithArgOfType(argType: GraphQLInputType) {
    const BadObjectType = new GraphQLObjectType({
      name: 'BadObject',
      fields: {
        badField: {
          type: GraphQLString,
          args: {
            badArg: { type: argType },
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
    });
  }

  for (const type of inputTypes) {
    const typeName = inspect(type);
    it(`accepts an input type as a field arg type: ${typeName}`, () => {
      const schema = schemaWithArgOfType(type);
      expect(validateSchema(schema)).to.deep.equal([]);
    });
  }

  it('rejects an empty field arg type', () => {
    // $DisableFlowOnNegativeTest
    const schema = schemaWithArgOfType(undefined);
    expect(validateSchema(schema)).to.deep.equal([
      {
        message:
          'The type of BadObject.badField(badArg:) must be Input Type but got: undefined.',
      },
    ]);
  });

  for (const type of notInputTypes) {
    const typeStr = inspect(type);
    it(`rejects a non-input type as a field arg type: ${typeStr}`, () => {
      // $DisableFlowOnNegativeTest
      const schema = schemaWithArgOfType(type);
      expect(validateSchema(schema)).to.deep.equal([
        {
          message: `The type of BadObject.badField(badArg:) must be Input Type but got: ${typeStr}.`,
        },
      ]);
    });
  }

  it('rejects a non-type value as a field arg type', () => {
    // $DisableFlowOnNegativeTest
    const schema = schemaWithArgOfType(Number);
    expect(validateSchema(schema)).to.deep.equal([
      {
        message: `The type of BadObject.badField(badArg:) must be Input Type but got: [function Number].`,
      },
      {
        message: `Expected GraphQL named type but got: [function Number].`,
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
    expect(validateSchema(schema)).to.deep.equal([
      {
        message:
          'The type of Query.test(arg:) must be Input Type but got: SomeObject.',
        locations: [{ line: 3, column: 19 }],
      },
    ]);
  });
});

describe('Type System: Input Object fields must have input types', () => {
  function schemaWithInputFieldOfType(inputFieldType: GraphQLInputType) {
    const BadInputObjectType = new GraphQLInputObjectType({
      name: 'BadInputObject',
      fields: {
        badField: { type: inputFieldType },
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
      const schema = schemaWithInputFieldOfType(type);
      expect(validateSchema(schema)).to.deep.equal([]);
    });
  }

  it('rejects an empty input field type', () => {
    // $DisableFlowOnNegativeTest
    const schema = schemaWithInputFieldOfType(undefined);
    expect(validateSchema(schema)).to.deep.equal([
      {
        message:
          'The type of BadInputObject.badField must be Input Type but got: undefined.',
      },
    ]);
  });

  for (const type of notInputTypes) {
    const typeStr = inspect(type);
    it(`rejects a non-input type as an input field type: ${typeStr}`, () => {
      // $DisableFlowOnNegativeTest
      const schema = schemaWithInputFieldOfType(type);
      expect(validateSchema(schema)).to.deep.equal([
        {
          message: `The type of BadInputObject.badField must be Input Type but got: ${typeStr}.`,
        },
      ]);
    });
  }

  it('rejects a non-type value as an input field type', () => {
    // $DisableFlowOnNegativeTest
    const schema = schemaWithInputFieldOfType(Number);
    expect(validateSchema(schema)).to.deep.equal([
      {
        message: `The type of BadInputObject.badField must be Input Type but got: [function Number].`,
      },
      {
        message: `Expected GraphQL named type but got: [function Number].`,
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
    expect(validateSchema(schema)).to.deep.equal([
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
    expect(validateSchema(schema)).to.deep.equal([]);
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
    expect(validateSchema(schema)).to.deep.equal([]);
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
    expect(validateSchema(schema)).to.deep.equal([]);
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
    expect(validateSchema(schema)).to.deep.equal([
      {
        message:
          'Interface field AnotherInterface.field expected but AnotherObject does not provide it.',
        locations: [{ line: 7, column: 9 }, { line: 10, column: 7 }],
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
    expect(validateSchema(schema)).to.deep.equal([
      {
        message:
          'Interface field AnotherInterface.field expects type String but AnotherObject.field is type Int.',
        locations: [{ line: 7, column: 31 }, { line: 11, column: 31 }],
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
    expect(validateSchema(schema)).to.deep.equal([
      {
        message:
          'Interface field AnotherInterface.field expects type A but AnotherObject.field is type B.',
        locations: [{ line: 10, column: 16 }, { line: 14, column: 16 }],
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
    expect(validateSchema(schema)).to.deep.equal([]);
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
    expect(validateSchema(schema)).to.deep.equal([]);
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
    expect(validateSchema(schema)).to.deep.equal([
      {
        message:
          'Interface field argument AnotherInterface.field(input:) expected but AnotherObject.field does not provide it.',
        locations: [{ line: 7, column: 15 }, { line: 11, column: 9 }],
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
    expect(validateSchema(schema)).to.deep.equal([
      {
        message:
          'Interface field argument AnotherInterface.field(input:) expects type String but AnotherObject.field(input:) is type Int.',
        locations: [{ line: 7, column: 22 }, { line: 11, column: 22 }],
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
    expect(validateSchema(schema)).to.deep.equal([
      {
        message:
          'Interface field AnotherInterface.field expects type String but AnotherObject.field is type Int.',
        locations: [{ line: 7, column: 31 }, { line: 11, column: 28 }],
      },
      {
        message:
          'Interface field argument AnotherInterface.field(input:) expects type String but AnotherObject.field(input:) is type Int.',
        locations: [{ line: 7, column: 22 }, { line: 11, column: 22 }],
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
    expect(validateSchema(schema)).to.deep.equal([
      {
        message:
          'Object field AnotherObject.field includes required argument requiredArg that is missing from the Interface field AnotherInterface.field.',
        locations: [{ line: 13, column: 11 }, { line: 7, column: 9 }],
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
    expect(validateSchema(schema)).to.deep.equal([]);
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
    expect(validateSchema(schema)).to.deep.equal([
      {
        message:
          'Interface field AnotherInterface.field expects type [String] but AnotherObject.field is type String.',
        locations: [{ line: 7, column: 16 }, { line: 11, column: 16 }],
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
    expect(validateSchema(schema)).to.deep.equal([
      {
        message:
          'Interface field AnotherInterface.field expects type String but AnotherObject.field is type [String].',
        locations: [{ line: 7, column: 16 }, { line: 11, column: 16 }],
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
    expect(validateSchema(schema)).to.deep.equal([]);
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
    expect(validateSchema(schema)).to.deep.equal([
      {
        message:
          'Interface field AnotherInterface.field expects type String! but AnotherObject.field is type String.',
        locations: [{ line: 7, column: 16 }, { line: 11, column: 16 }],
      },
    ]);
  });
});
