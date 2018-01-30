/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
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
  parseValue() {},
  parseLiteral() {},
});

const SomeObjectType = new GraphQLObjectType({
  name: 'SomeObject',
  fields: { f: { type: GraphQLString } },
});

const SomeUnionType = new GraphQLUnionType({
  name: 'SomeUnion',
  types: [SomeObjectType],
});

const SomeInterfaceType = new GraphQLInterfaceType({
  name: 'SomeInterface',
  fields: { f: { type: GraphQLString } },
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

function withModifiers(types) {
  return types
    .concat(types.map(type => GraphQLList(type)))
    .concat(types.map(type => GraphQLNonNull(type)))
    .concat(types.map(type => GraphQLNonNull(GraphQLList(type))));
}

const outputTypes = withModifiers([
  GraphQLString,
  SomeScalarType,
  SomeEnumType,
  SomeObjectType,
  SomeUnionType,
  SomeInterfaceType,
]);

const notOutputTypes = withModifiers([SomeInputObjectType]).concat(Number);

const inputTypes = withModifiers([
  GraphQLString,
  SomeScalarType,
  SomeEnumType,
  SomeInputObjectType,
]);

const notInputTypes = withModifiers([
  SomeObjectType,
  SomeUnionType,
  SomeInterfaceType,
]).concat(Number);

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
    expect(validateSchema(schema)).to.containSubset([
      {
        message: 'Query root type must be provided.',
        locations: undefined,
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
    expect(validateSchema(schemaWithDef)).to.containSubset([
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
    expect(validateSchema(schema)).to.containSubset([
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
    expect(validateSchema(schemaWithDef)).to.containSubset([
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
    expect(validateSchema(schema)).to.containSubset([
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
    expect(validateSchema(schemaWithDef)).to.containSubset([
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
    expect(validateSchema(schema)).to.containSubset([
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
    expect(validateSchema(schemaWithDef)).to.containSubset([
      {
        message:
          'Subscription root type must be Object type if provided, it cannot be SomeInputObject.',
        locations: [{ line: 4, column: 23 }],
      },
    ]);
  });

  it('rejects a Schema whose directives are incorrectly typed', () => {
    const schema = new GraphQLSchema({
      query: SomeObjectType,
      directives: ['somedirective'],
    });
    expect(validateSchema(schema)).to.containSubset([
      {
        message: 'Expected directive but got: somedirective.',
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
    expect(validateSchema(schema)).to.containSubset([
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
    expect(validateSchema(manualSchema)).to.containSubset([
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
    expect(validateSchema(manualSchema2)).to.containSubset([
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
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Names must match /^[_a-zA-Z][_a-zA-Z0-9]*$/ but ' +
          '"bad-name-with-dashes" does not.',
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
    expect(validateSchema(schemaBad)).to.containSubset([
      {
        message:
          'Name "__badName" must not begin with "__", which is reserved by ' +
          'GraphQL introspection.',
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
    expect(validateSchema(schema)).to.containSubset([
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
    const schema = buildSchema(`
      type Query {
        test: BadUnion
      }

      union BadUnion
    `);
    expect(validateSchema(schema)).to.containSubset([
      {
        message: 'Union type BadUnion must define one or more member types.',
        locations: [{ line: 6, column: 7 }],
      },
    ]);
  });

  it('rejects a Union type with duplicated member type', () => {
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
        | TypeB
        | TypeA
    `);
    expect(validateSchema(schema)).to.containSubset([
      {
        message: 'Union type BadUnion can only include type TypeA once.',
        locations: [{ line: 15, column: 11 }, { line: 17, column: 11 }],
      },
    ]);
  });

  it('rejects a Union type with non-Object members types', () => {
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
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Union type BadUnion can only include Object types, ' +
          'it cannot include String.',
        locations: [{ line: 16, column: 11 }],
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
    badUnionMemberTypes.forEach(memberType => {
      const badSchema = schemaWithFieldType(
        new GraphQLUnionType({ name: 'BadUnion', types: [memberType] }),
      );
      expect(validateSchema(badSchema)).to.containSubset([
        {
          message:
            'Union type BadUnion can only include Object types, ' +
            `it cannot include ${memberType}.`,
        },
      ]);
    });
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
    const schema = buildSchema(`
      type Query {
        field(arg: SomeInputObject): String
      }

      input SomeInputObject
    `);
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Input Object type SomeInputObject must define one or more fields.',
        locations: [{ line: 6, column: 7 }],
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
    expect(validateSchema(schema)).to.containSubset([
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
    const schema = buildSchema(`
      type Query {
        field: SomeEnum
      }

      enum SomeEnum
    `);
    expect(validateSchema(schema)).to.containSubset([
      {
        message: 'Enum type SomeEnum must define one or more values.',
        locations: [{ line: 6, column: 7 }],
      },
    ]);
  });

  it('rejects an Enum type with duplicate values', () => {
    const schema = buildSchema(`
      type Query {
        field: SomeEnum
      }

      enum SomeEnum {
        SOME_VALUE
        SOME_VALUE
      }
    `);
    expect(validateSchema(schema)).to.containSubset([
      {
        message: 'Enum type SomeEnum can include value SOME_VALUE only once.',
        locations: [{ line: 7, column: 9 }, { line: 8, column: 9 }],
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
    expect(validateSchema(schema1)).to.containSubset([
      {
        message:
          'Names must match /^[_a-zA-Z][_a-zA-Z0-9]*$/ but "#value" does not.',
      },
    ]);

    const schema2 = schemaWithEnum('1value');
    expect(validateSchema(schema2)).to.containSubset([
      {
        message:
          'Names must match /^[_a-zA-Z][_a-zA-Z0-9]*$/ but "1value" does not.',
      },
    ]);

    const schema3 = schemaWithEnum('KEBAB-CASE');
    expect(validateSchema(schema3)).to.containSubset([
      {
        message:
          'Names must match /^[_a-zA-Z][_a-zA-Z0-9]*$/ but "KEBAB-CASE" does not.',
      },
    ]);

    const schema4 = schemaWithEnum('true');
    expect(validateSchema(schema4)).to.containSubset([
      { message: 'Enum type SomeEnum cannot include value: true.' },
    ]);

    const schema5 = schemaWithEnum('false');
    expect(validateSchema(schema5)).to.containSubset([
      { message: 'Enum type SomeEnum cannot include value: false.' },
    ]);

    const schema6 = schemaWithEnum('null');
    expect(validateSchema(schema6)).to.containSubset([
      { message: 'Enum type SomeEnum cannot include value: null.' },
    ]);
  });
});

describe('Type System: Object fields must have output types', () => {
  function schemaWithObjectFieldOfType(fieldType) {
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
    });
  }

  outputTypes.forEach(type => {
    it(`accepts an output type as an Object field type: ${type}`, () => {
      const schema = schemaWithObjectFieldOfType(type);
      expect(validateSchema(schema)).to.deep.equal([]);
    });
  });

  it('rejects an empty Object field type', () => {
    const schema = schemaWithObjectFieldOfType(undefined);
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'The type of BadObject.badField must be Output Type but got: undefined.',
      },
    ]);
  });

  notOutputTypes.forEach(type => {
    it(`rejects a non-output type as an Object field type: ${type}`, () => {
      const schema = schemaWithObjectFieldOfType(type);
      expect(validateSchema(schema)).to.containSubset([
        {
          message: `The type of BadObject.badField must be Output Type but got: ${type}.`,
        },
      ]);
    });
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
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'The type of Query.field must be Output Type but got: [SomeInputObject].',
        locations: [{ line: 3, column: 16 }],
      },
    ]);
  });
});

describe('Type System: Objects can only implement unique interfaces', () => {
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
    expect(validateSchema(schema)).to.containSubset([
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
    expect(validateSchema(schema)).to.containSubset([
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
    expect(validateSchema(extendedSchema)).to.containSubset([
      {
        message: 'Type AnotherObject can only implement AnotherInterface once.',
        locations: [{ line: 10, column: 37 }, { line: 1, column: 38 }],
      },
    ]);
  });
});

describe('Type System: Interface fields must have output types', () => {
  function schemaWithInterfaceFieldOfType(fieldType) {
    const BadInterfaceType = new GraphQLInterfaceType({
      name: 'BadInterface',
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
    });
  }

  outputTypes.forEach(type => {
    it(`accepts an output type as an Interface field type: ${type}`, () => {
      const schema = schemaWithInterfaceFieldOfType(type);
      expect(validateSchema(schema)).to.deep.equal([]);
    });
  });

  it('rejects an empty Interface field type', () => {
    const schema = schemaWithInterfaceFieldOfType(undefined);
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'The type of BadInterface.badField must be Output Type but got: undefined.',
      },
    ]);
  });

  notOutputTypes.forEach(type => {
    it(`rejects a non-output type as an Interface field type: ${type}`, () => {
      const schema = schemaWithInterfaceFieldOfType(type);
      expect(validateSchema(schema)).to.containSubset([
        {
          message: `The type of BadInterface.badField must be Output Type but got: ${type}.`,
        },
      ]);
    });
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
    `);
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'The type of SomeInterface.field must be Output Type but got: SomeInputObject.',
        locations: [{ line: 7, column: 16 }],
      },
    ]);
  });
});

describe('Type System: Field arguments must have input types', () => {
  function schemaWithArgOfType(argType) {
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

  inputTypes.forEach(type => {
    it(`accepts an input type as a field arg type: ${type}`, () => {
      const schema = schemaWithArgOfType(type);
      expect(validateSchema(schema)).to.deep.equal([]);
    });
  });

  it('rejects an empty field arg type', () => {
    const schema = schemaWithArgOfType(undefined);
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'The type of BadObject.badField(badArg:) must be Input Type but got: undefined.',
      },
    ]);
  });

  notInputTypes.forEach(type => {
    it(`rejects a non-input type as a field arg type: ${type}`, () => {
      const schema = schemaWithArgOfType(type);
      expect(validateSchema(schema)).to.containSubset([
        {
          message: `The type of BadObject.badField(badArg:) must be Input Type but got: ${type}.`,
        },
      ]);
    });
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
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'The type of Query.test(arg:) must be Input Type but got: SomeObject.',
        locations: [{ line: 3, column: 19 }],
      },
    ]);
  });
});

describe('Type System: Input Object fields must have input types', () => {
  function schemaWithInputFieldOfType(inputFieldType) {
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

  inputTypes.forEach(type => {
    it(`accepts an input type as an input field type: ${type}`, () => {
      const schema = schemaWithInputFieldOfType(type);
      expect(validateSchema(schema)).to.deep.equal([]);
    });
  });

  it('rejects an empty input field type', () => {
    const schema = schemaWithInputFieldOfType(undefined);
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'The type of BadInputObject.badField must be Input Type but got: undefined.',
      },
    ]);
  });

  notInputTypes.forEach(type => {
    it(`rejects a non-input type as an input field type: ${type}`, () => {
      const schema = schemaWithInputFieldOfType(type);
      expect(validateSchema(schema)).to.containSubset([
        {
          message: `The type of BadInputObject.badField must be Input Type but got: ${type}.`,
        },
      ]);
    });
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
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'The type of SomeInputObject.foo must be Input Type but got: SomeObject.',
        locations: [{ line: 7, column: 14 }],
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
    expect(validateSchema(schema)).to.deep.equal([]);
  });

  it('accepts an Interface which implements an Interface with more fields', () => {
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
    expect(validateSchema(schema)).to.deep.equal([]);
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
    expect(validateSchema(schema)).to.deep.equal([]);
  });

  it('rejects an Interface missing an Interface field', () => {
    const schema = buildSchema(`
      type Query {
        test: SomeObject
      }

      interface ParentInterface {
        field(input: String): String
      }

      interface ChildInterface implements ParentInterface {
        anotherField: String
      }

      type SomeObject implements ParentInterface & ChildInterface {
        field(input: String, anotherInput: String): String
        anotherField: String
      }
    `);
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Interface field ParentInterface.field expected but ' +
          'ChildInterface does not provide it.',
        locations: [{ line: 7, column: 9 }, { line: 10, column: 7 }],
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
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Interface field ParentInterface.field expects type String but ' +
          'ChildInterface.field is type Int.',
        locations: [{ line: 7, column: 31 }, { line: 11, column: 31 }],
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
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Interface field ParentInterface.field expects type A but ' +
          'ChildInterface.field is type B.',
        locations: [{ line: 10, column: 16 }, { line: 14, column: 16 }],
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

      type ChildInterface implements ParentInterface {
        field: ChildInterface
      }
    `);
    expect(validateSchema(schema)).to.deep.equal([]);
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

      type ChildInterface implements ParentInterface {
        field: SomeObject
      }
    `);
    expect(validateSchema(schema)).to.deep.equal([]);
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
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Interface field argument ParentInterface.field(input:) expected ' +
          'but ChildInterface.field does not provide it.',
        locations: [{ line: 7, column: 15 }, { line: 11, column: 9 }],
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
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Interface field argument ParentInterface.field(input:) expects ' +
          'type String but ChildInterface.field(input:) is type Int.',
        locations: [{ line: 7, column: 22 }, { line: 11, column: 22 }],
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
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Interface field ParentInterface.field expects type String but ' +
          'ChildInterface.field is type Int.',
        locations: [{ line: 7, column: 31 }, { line: 11, column: 28 }],
      },
      {
        message:
          'Interface field argument ParentInterface.field(input:) expects ' +
          'type String but ChildInterface.field(input:) is type Int.',
        locations: [{ line: 7, column: 22 }, { line: 11, column: 22 }],
      },
    ]);
  });

  it('rejects an Interface which implements an Interface field along with additional required arguments', () => {
    const schema = buildSchema(`
      type Query {
        test: ChildInterface
      }

      interface ParentInterface {
        field(input: String): String
      }

      interface ChildInterface implements ParentInterface {
        field(input: String, anotherInput: String!): String
      }
    `);
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Field argument ChildInterface.field(anotherInput:) is of ' +
          'required type String! but is not also provided by the Interface ' +
          'field ParentInterface.field.',
        locations: [{ line: 11, column: 44 }, { line: 7, column: 9 }],
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
    expect(validateSchema(schema)).to.deep.equal([]);
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
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Interface field ParentInterface.field expects type [String] ' +
          'but ChildInterface.field is type String.',
        locations: [{ line: 7, column: 16 }, { line: 11, column: 16 }],
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
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Interface field ParentInterface.field expects type String but ' +
          'ChildInterface.field is type [String].',
        locations: [{ line: 7, column: 16 }, { line: 11, column: 16 }],
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
    expect(validateSchema(schema)).to.deep.equal([]);
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
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Interface field ParentInterface.field expects type String! ' +
          'but ChildInterface.field is type String.',
        locations: [{ line: 7, column: 16 }, { line: 11, column: 16 }],
      },
    ]);
  });

  it('rejects an Interface that does not implement all its ancestors', () => {
    const schema = buildSchema(`
      type Query {
        test: ChildInterface
      }

      interface ParentInterface {
        field: String
      }

      interface ChildInterface implements ParentInterface {
        field: String
        anotherField: String
      }

      interface GrandchildInterface implements ChildInterface {
        field: String
        anotherField: String
      }
    `);
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Type GrandchildInterface must implement ParentInterface because it is implemented by ChildInterface',
        locations: [{ line: 15, column: 48 }],
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
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Interface field AnotherInterface.field expected but ' +
          'AnotherObject does not provide it.',
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
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Interface field AnotherInterface.field expects type String but ' +
          'AnotherObject.field is type Int.',
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
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Interface field AnotherInterface.field expects type A but ' +
          'AnotherObject.field is type B.',
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
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Interface field argument AnotherInterface.field(input:) expected ' +
          'but AnotherObject.field does not provide it.',
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
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Interface field argument AnotherInterface.field(input:) expects ' +
          'type String but AnotherObject.field(input:) is type Int.',
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
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Interface field AnotherInterface.field expects type String but ' +
          'AnotherObject.field is type Int.',
        locations: [{ line: 7, column: 31 }, { line: 11, column: 28 }],
      },
      {
        message:
          'Interface field argument AnotherInterface.field(input:) expects ' +
          'type String but AnotherObject.field(input:) is type Int.',
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
        field(input: String): String
      }

      type AnotherObject implements AnotherInterface {
        field(input: String, anotherInput: String!): String
      }
    `);
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Field argument AnotherObject.field(anotherInput:) is of ' +
          'required type String! but is not also provided by the Interface ' +
          'field AnotherInterface.field.',
        locations: [{ line: 11, column: 44 }, { line: 7, column: 9 }],
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
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Interface field AnotherInterface.field expects type [String] ' +
          'but AnotherObject.field is type String.',
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
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Interface field AnotherInterface.field expects type String but ' +
          'AnotherObject.field is type [String].',
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
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Interface field AnotherInterface.field expects type String! ' +
          'but AnotherObject.field is type String.',
        locations: [{ line: 7, column: 16 }, { line: 11, column: 16 }],
      },
    ]);
  });

  it('rejects an Object that does not implement all its ancestors', () => {
    const schema = buildSchema(`
      type Query {
        test: AnotherObject
      }

      interface ParentInterface {
        field: String
      }

      interface ChildInterface implements ParentInterface {
        field: String
        anotherField: String
      }

      interface GrandchildInterface implements ChildInterface & ParentInterface {
        field: String
        anotherField: String
      }

      type AnotherObject implements GrandchildInterface {
        field: String
        anotherField: String
      }
    `);
    expect(validateSchema(schema)).to.containSubset([
      {
        message:
          'Type AnotherObject must implement ChildInterface because it is implemented by GrandchildInterface',
        locations: [{ line: 20, column: 37 }],
      },
      {
        message:
          'Type AnotherObject must implement ParentInterface because it is implemented by ChildInterface, GrandchildInterface',
        locations: [{ line: 20, column: 37 }],
      },
    ]);
  });
});
