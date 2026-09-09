import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import { parse } from '../../../language/parser.ts';

import {
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from '../../../type/definition.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../index.ts';

import { InputObjectValuesAreFiniteTypeSystemValidation } from '../InputObjectValuesAreFiniteRule.ts';

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  const doc = parse(sdlStr, { noLocation: true });
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [InputObjectValuesAreFiniteTypeSystemValidation],
    schema,
  });
  return expectJSON(errors);
}

function expectSDLErrorsWithLocations(sdlStr: string, schema?: GraphQLSchema) {
  const doc = parse(sdlStr);
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [InputObjectValuesAreFiniteTypeSystemValidation],
    schema,
  });
  return expectJSON(errors);
}

describe('Validate: InputObjectValuesAreFiniteRule', () => {
  it('rejects SDL input object non-null cycles', () => {
    expectSDLErrors(`
      input A {
        self: A!
      }
    `).toDeepEqual([
      {
        message:
          'Input Object A cannot be provided a finite value because it references itself through fields: A.self.',
      },
    ]);
  });

  it('rejects SDL OneOf input object cycles after extensions are known', () => {
    expectSDLErrors(`
      input A @oneOf {
        self: A
      }

      extend input A {
        other: String
      }
    `).toDeepEqual([]);

    expectSDLErrors(`
      input B @oneOf {
        self: B
      }
    `).toDeepEqual([
      {
        message:
          'Input Object B cannot be provided a finite value because it references itself through fields: B.self.',
      },
    ]);

    expectSDLErrors(`
      input C @oneOf {
        list: [C]
      }
    `).toDeepEqual([]);

    expectSDLErrors(`
      input D {
        self: D
      }

      extend input D @oneOf
    `).toDeepEqual([]);
  });

  it('accepts SDL finite values propagated through dependent input objects', () => {
    expectSDLErrors(`
      input Leaf {
        value: String
      }

      input A {
        b: B!
      }

      input B {
        leaf: Leaf
      }

      input C @oneOf {
        b: B
      }

      input ListEscape {
        items: [ListEscape]
      }

      input Empty
    `).toDeepEqual([]);
  });

  it('rejects SDL cycles across multiple input object types once', () => {
    expectSDLErrors(`
      input A {
        b: B!
      }

      input B {
        a: A!
      }
    `).toDeepEqual([
      {
        message:
          'Input Object A cannot be provided a finite value because it references itself through fields: A.b, B.a.',
      },
    ]);
  });

  it('reports SDL input object finite value cycles on the cycling field nodes', () => {
    expectSDLErrorsWithLocations(`
      input A {
        b: B!
      }

      input B {
        a: A!
      }
    `).toDeepEqual([
      {
        message:
          'Input Object A cannot be provided a finite value because it references itself through fields: A.b, B.a.',
        locations: [
          { line: 3, column: 9 },
          { line: 7, column: 9 },
        ],
      },
    ]);
  });

  it('skips finite targets while reporting SDL cycles', () => {
    expectSDLErrors(`
      input Finite {
        value: String
      }

      input A {
        finite: Finite!
        cycle: C!
      }

      input C {
        a: A!
      }
    `).toDeepEqual([
      {
        message:
          'Input Object A cannot be provided a finite value because it references itself through fields: A.cycle, C.a.',
      },
    ]);
  });

  it('uses existing schema input object fields when validating SDL', () => {
    const AType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'A',
      fields: () => ({
        scalar: { type: new GraphQLNonNull(GraphQLString) },
        list: { type: new GraphQLList(AType) },
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

    expectSDLErrors('extend input A { extra: String }', schema).toDeepEqual([]);
  });

  it('reports SDL cycles through existing schema input object fields', () => {
    const AType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'A',
      fields: () => ({
        b: { type: new GraphQLNonNull(BType) },
      }),
    });

    const BType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'B',
      fields: {},
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

    expectSDLErrors('extend input B { a: A! }', schema).toDeepEqual([
      {
        message:
          'Input Object A cannot be provided a finite value because it references itself through fields: A.b, B.a.',
      },
    ]);
  });

  it('ignores existing schema-only cycles during document validation', () => {
    const AType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'A',
      fields: () => ({
        self: { type: new GraphQLNonNull(AType) },
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

    expectSDLErrors('directive @tag on SCHEMA', schema).toDeepEqual([]);
  });

  it('ignores existing schema-only cycles when an SDL extension touches the type', () => {
    const AType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'A',
      fields: () => ({
        self: { type: new GraphQLNonNull(AType) },
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

    expectSDLErrors('extend input A { extra: String }', schema).toDeepEqual([]);
  });

  it('rejects schema input object non-null cycles', () => {
    const AType: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'A',
      fields: () => ({
        self: { type: new GraphQLNonNull(AType) },
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
        typeSystemRules: [InputObjectValuesAreFiniteTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message:
          'Input Object A cannot be provided a finite value because it references itself through fields: A.self.',
      },
    ]);
  });

  it('accepts schema finite values propagated through dependent input objects', () => {
    const Leaf = new GraphQLInputObjectType({
      name: 'Leaf',
      fields: {
        value: { type: GraphQLString },
      },
    });
    const B = new GraphQLInputObjectType({
      name: 'B',
      fields: {
        leaf: { type: Leaf },
      },
    });
    const A = new GraphQLInputObjectType({
      name: 'A',
      fields: {
        b: { type: new GraphQLNonNull(B) },
      },
    });
    const One = new GraphQLInputObjectType({
      name: 'One',
      isOneOf: true,
      fields: {
        b: { type: B },
      },
    });
    const OneWithTwoFiniteTargets = new GraphQLInputObjectType({
      name: 'OneWithTwoFiniteTargets',
      isOneOf: true,
      fields: {
        b: { type: B },
        leaf: { type: Leaf },
      },
    });
    const OneWithScalar = new GraphQLInputObjectType({
      name: 'OneWithScalar',
      isOneOf: true,
      fields: {
        scalar: { type: GraphQLString },
      },
    });
    const Empty = new GraphQLInputObjectType({
      name: 'Empty',
      fields: {},
    });
    const ListEscape: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'ListEscape',
      fields: () => ({
        items: { type: new GraphQLList(ListEscape) },
      }),
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: {
            type: GraphQLString,
            args: { arg: { type: A } },
          },
        },
      }),
      types: [One, OneWithTwoFiniteTargets, OneWithScalar, Empty, ListEscape],
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [InputObjectValuesAreFiniteTypeSystemValidation],
      }),
    ).toDeepEqual([]);
  });

  it('rejects schema OneOf input object cycles', () => {
    const One: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'One',
      isOneOf: true,
      fields: () => ({
        self: { type: One },
      }),
    });

    expectJSON(
      validateWithRules({
        schema: schemaWithInput(One),
        typeSystemRules: [InputObjectValuesAreFiniteTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message:
          'Input Object One cannot be provided a finite value because it references itself through fields: One.self.',
      },
    ]);
  });

  it('skips finite schema targets while reporting cycles', () => {
    const Finite = new GraphQLInputObjectType({
      name: 'Finite',
      fields: {
        value: { type: GraphQLString },
      },
    });
    const A: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'A',
      fields: () => ({
        finite: { type: new GraphQLNonNull(Finite) },
        cycle: { type: new GraphQLNonNull(C) },
      }),
    });
    const C: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'C',
      fields: () => ({
        a: { type: new GraphQLNonNull(A) },
      }),
    });

    expectJSON(
      validateWithRules({
        schema: schemaWithInput(A),
        typeSystemRules: [InputObjectValuesAreFiniteTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message:
          'Input Object A cannot be provided a finite value because it references itself through fields: A.cycle, C.a.',
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
