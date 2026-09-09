import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import type {
  ConstValueNode,
  InputObjectTypeDefinitionNode,
} from '../../../language/ast.ts';
import { parse, parseValue } from '../../../language/parser.ts';

import {
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from '../../../type/definition.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';

import { validateWithRules } from '../../index.ts';

import { NoInputObjectDefaultValueCyclesTypeSystemValidation } from '../NoInputObjectDefaultValueCyclesRule.ts';

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  const doc = parse(sdlStr, { noLocation: true });
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [NoInputObjectDefaultValueCyclesTypeSystemValidation],
    schema,
  });
  return expectJSON(errors);
}

function expectSDLErrorsWithLocations(sdlStr: string, schema?: GraphQLSchema) {
  const doc = parse(sdlStr);
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [NoInputObjectDefaultValueCyclesTypeSystemValidation],
    schema,
  });
  return expectJSON(errors);
}

describe('Validate: NoInputObjectDefaultValueCyclesRule', () => {
  it('rejects SDL input object default value cycles', () => {
    expectSDLErrors(`
      input A {
        self: A = {}
      }
    `).toDeepEqual([
      {
        message:
          'Invalid circular reference. The default value of Input Object field A.self references itself.',
      },
    ]);
  });

  it('rejects SDL cycles across input object extensions', () => {
    expectSDLErrors(`
      input A {
        first: B = {}
      }

      input B {
        second: C = {}
      }

      extend input C {
        third: A = {}
      }
    `).toDeepEqual([
      {
        message:
          'Invalid circular reference. The default value of Input Object field A.first references itself via the default values of: B.second, C.third.',
      },
    ]);
  });

  it('checks every duplicate SDL default value field literal', () => {
    expectSDLErrors(`
      input A {
        self: A = { self: {}, self: null }
      }
    `).toDeepEqual([
      {
        message:
          'Invalid circular reference. The default value of Input Object field A.self references itself.',
      },
    ]);
  });

  it('reports SDL input object default value cycles on the default value nodes', () => {
    expectSDLErrorsWithLocations(`
      input A {
        first: B = {}
      }

      input B {
        second: C = {}
      }

      extend input C {
        third: A = {}
      }
    `).toDeepEqual([
      {
        message:
          'Invalid circular reference. The default value of Input Object field A.first references itself via the default values of: B.second, C.third.',
        locations: [
          { line: 3, column: 20 },
          { line: 7, column: 21 },
          { line: 11, column: 20 },
        ],
      },
    ]);
  });

  it('accepts existing schema defaults while validating SDL', () => {
    const AType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'A',
      fields: () => ({
        list: {
          type: new GraphQLList(AType),
          default: {
            value: [{ list: null, object: null, literalList: null }],
          },
        },
        object: {
          type: AType,
          default: { value: { list: null, object: null, literalList: null } },
        },
        nonNullObject: {
          type: new GraphQLNonNull(AType),
          default: {
            value: {
              list: null,
              object: null,
              literalList: null,
              nonNullObject: null,
            },
          },
        },
        literalList: {
          type: new GraphQLList(AType),
          default: {
            literal: parseValue(
              '[{ list: null, object: null, literalList: null }]',
            ) as ConstValueNode,
          },
        },
        literalScalar: {
          type: AType,
          default: { literal: parseValue('"value"') as ConstValueNode },
        },
      }),
    });

    expectSDLErrors(
      'extend input A { extra: String }',
      schemaWithInput(AType),
    ).toDeepEqual([]);
  });

  it('accepts SDL input object fields without default values', () => {
    expectSDLErrors(`
      input Empty

      input Wrapped {
        child: Wrapped
        list: [Wrapped]
        nonNull: Wrapped!
      }
    `).toDeepEqual([]);
  });

  it('uses existing schema default value AST nodes when available', () => {
    const schema = buildSchema(`
      input A {
        value: String = "value"
      }

      type Query {
        field(arg: A): String
      }
    `);

    expectSDLErrors('extend input A { other: String }', schema).toDeepEqual([]);
  });

  it('ignores existing schema-only default value cycles during document validation', () => {
    const AType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'A',
      fields: () => ({
        self: { type: AType, default: { value: {} } },
      }),
    });

    expectSDLErrors(
      `
        directive @tag on SCHEMA
        extend schema @tag
      `,
      schemaWithInput(AType),
    ).toDeepEqual([]);
  });

  it('ignores existing schema-only default value cycles when an SDL extension touches the type', () => {
    const AType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'A',
      fields: () => ({
        self: { type: AType, default: { value: {} } },
      }),
    });

    expectSDLErrors(
      'extend input A { extra: String }',
      schemaWithInput(AType),
    ).toDeepEqual([]);
  });

  it('reports SDL default cycles through existing schema input object fields', () => {
    const AType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'A',
      fields: () => ({
        b: { type: BType, default: { value: {} } },
      }),
    });

    const BType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'B',
      fields: {
        a: { type: AType },
      },
    });

    expectSDLErrors(
      'extend input B { a: A = {} }',
      schemaWithInput(AType),
    ).toDeepEqual([
      {
        message:
          'Invalid circular reference. The default value of Input Object field A.b references itself via the default values of: B.a.',
      },
    ]);
  });

  it('rejects schema input object default value cycles', () => {
    const AType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'A',
      fields: () => ({
        self: { type: AType, default: { value: {} } },
      }),
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: {
            type: GraphQLString,
            args: { arg: { type: AType } },
          },
        },
      }),
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [NoInputObjectDefaultValueCyclesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message:
          'Invalid circular reference. The default value of Input Object field A.self references itself.',
      },
    ]);
  });

  it('rejects schema input object default value cycles across fields', () => {
    const aDefinition = parse('input A { b: B = {} }', { noLocation: true })
      .definitions[0] as InputObjectTypeDefinitionNode;
    const bDefinition = parse('input B { a: A = {} }', { noLocation: true })
      .definitions[0] as InputObjectTypeDefinitionNode;
    const aFieldNode = aDefinition.fields?.[0];
    const bFieldNode = bDefinition.fields?.[0];
    if (aFieldNode == null || bFieldNode == null) {
      throw new Error('Expected input field nodes.');
    }

    const AType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'A',
      fields: () => ({
        b: { type: BType, default: { value: {} }, astNode: aFieldNode },
      }),
    });
    const BType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'B',
      fields: {
        a: { type: AType, default: { value: {} }, astNode: bFieldNode },
      },
    });

    expectJSON(
      validateWithRules({
        schema: schemaWithInput(AType),
        typeSystemRules: [NoInputObjectDefaultValueCyclesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message:
          'Invalid circular reference. The default value of Input Object field A.b references itself via the default values of: B.a.',
      },
    ]);
  });

  it('accepts schema input object defaults without cycles', () => {
    const AType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'A',
      fields: () => ({
        list: {
          type: new GraphQLList(AType),
          default: {
            value: [
              {
                list: null,
                object: null,
                literalList: null,
                child: null,
                scalar: 'value',
              },
            ],
          },
        },
        object: {
          type: AType,
          default: {
            value: {
              list: null,
              object: null,
              literalList: null,
              child: null,
              scalar: 'value',
            },
          },
        },
        literalList: {
          type: new GraphQLList(AType),
          default: {
            literal: parseValue(
              '[{ list: null, object: null, literalList: null, child: null, scalar: "value" }]',
            ) as ConstValueNode,
          },
        },
        child: { type: AType },
        scalar: { type: GraphQLString },
      }),
    });

    expectJSON(
      validateWithRules({
        schema: schemaWithInput(AType),
        typeSystemRules: [NoInputObjectDefaultValueCyclesTypeSystemValidation],
      }),
    ).toDeepEqual([]);
  });

  it('accepts schema input objects without default values', () => {
    const AType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'A',
      fields: () => ({
        child: { type: AType },
        list: { type: new GraphQLList(AType) },
        scalar: { type: GraphQLString },
      }),
    });

    expectJSON(
      validateWithRules({
        schema: schemaWithInput(AType),
        typeSystemRules: [NoInputObjectDefaultValueCyclesTypeSystemValidation],
      }),
    ).toDeepEqual([]);
  });

  it('checks every duplicate schema default value field literal', () => {
    const AType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'A',
      fields: () => ({
        self: {
          type: AType,
          default: {
            literal: parseValue('{ self: {}, self: null }') as ConstValueNode,
          },
        },
      }),
    });

    expectJSON(
      validateWithRules({
        schema: schemaWithInput(AType),
        typeSystemRules: [NoInputObjectDefaultValueCyclesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message:
          'Invalid circular reference. The default value of Input Object field A.self references itself.',
      },
    ]);
  });
});

function schemaWithInput(inputType: GraphQLInputObjectType): GraphQLSchema {
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        field: {
          type: GraphQLString,
          args: { arg: { type: inputType } },
        },
      },
    }),
  });
}
