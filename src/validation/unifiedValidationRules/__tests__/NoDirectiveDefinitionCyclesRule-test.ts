import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import type { DirectiveDefinitionNode } from '../../../language/ast.ts';
import { DirectiveLocation } from '../../../language/directiveLocation.ts';
import { parse } from '../../../language/parser.ts';

import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLScalarType,
} from '../../../type/definition.ts';
import {
  GraphQLDeprecatedDirective,
  GraphQLDirective,
  specifiedDirectives,
} from '../../../type/directives.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';
import { extendSchema } from '../../../utilities/extendSchema.ts';

import { validateWithRules } from '../../index.ts';

import { NoDirectiveDefinitionCyclesTypeSystemValidation } from '../NoDirectiveDefinitionCyclesRule.ts';

function expectSDLErrors(sdlStr: string) {
  const doc = parse(sdlStr);
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [NoDirectiveDefinitionCyclesTypeSystemValidation],
  });
  return expectJSON(errors);
}

function expectSDLErrorsWithoutLocations(sdlStr: string) {
  const doc = parse(sdlStr, { noLocation: true });
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [NoDirectiveDefinitionCyclesTypeSystemValidation],
  });
  return expectJSON(errors);
}

function expectSDLErrorsWithSchema(sdlStr: string, schema: GraphQLSchema) {
  const doc = parse(sdlStr);
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [NoDirectiveDefinitionCyclesTypeSystemValidation],
    schema,
  });
  return expectJSON(errors);
}

describe('Validate: NoDirectiveDefinitionCyclesRule', () => {
  it('ignores documents without directive definitions or extensions', () => {
    expectSDLErrors(`
      type Query {
        field: String @deprecated
      }
    `).toDeepEqual([]);
  });

  it('ignores child input values outside directive reference sources', () => {
    expectSDLErrors(`
      directive @noop on FIELD_DEFINITION

      type Query {
        field(arg: String): String
      }
    `).toDeepEqual([]);
  });

  it('handles directive-only enum and input object reference sources', () => {
    expectSDLErrors(`
      directive @noop on ENUM | INPUT_OBJECT

      enum Color @noop
      extend enum Color @noop

      input Filter @noop
      extend input Filter @noop
    `).toDeepEqual([]);
  });

  it('rejects a self-referential directive definition', () => {
    expectSDLErrors(`
      directive @self(arg: String @self) on FIELD_DEFINITION
    `).toDeepEqual([
      {
        message:
          'Directive "@self" forms a reference cycle through: "@self(arg:)", directive application "@self".',
        locations: [
          { line: 2, column: 23 },
          { line: 2, column: 35 },
        ],
      },
    ]);
  });

  it('records forward directive references', () => {
    expectSDLErrors(`
      directive @a(arg: String @b @b) on FIELD_DEFINITION
      directive @b(arg: String @a) on FIELD_DEFINITION
    `).toDeepEqual([
      {
        message:
          'Directive "@a" forms a reference cycle through: "@a(arg:)", directive application "@b", "@b(arg:)", directive application "@a".',
        locations: [
          { line: 2, column: 20 },
          { line: 2, column: 32 },
          { line: 3, column: 20 },
          { line: 3, column: 32 },
        ],
      },
    ]);
  });

  it('rejects directive cycles through input object fields', () => {
    expectSDLErrors(`
      directive @a(arg: InputObject) on INPUT_FIELD_DEFINITION

      input InputObject {
        self: InputObject @a
      }
    `).toDeepEqual([
      {
        message:
          'Directive "@a" forms a reference cycle through: "@a(arg:)", "InputObject", "InputObject.self", directive application "@a".',
        locations: [
          { line: 2, column: 20 },
          { line: 2, column: 25 },
          { line: 5, column: 9 },
          { line: 5, column: 27 },
        ],
      },
    ]);
  });

  it('unwraps directive argument types when recording directive cycles', () => {
    expectSDLErrorsWithoutLocations(`
      directive @a(arg: [InputObject!]!) on INPUT_FIELD_DEFINITION

      input InputObject {
        self: InputObject @a
      }
    `).toDeepEqual([
      {
        message:
          'Directive "@a" forms a reference cycle through: "@a(arg:)", "InputObject", "InputObject.self", directive application "@a".',
      },
    ]);
  });

  it('reports directive cycles when a non-directive coordinate repeats', () => {
    expectSDLErrors(`
      directive @a(arg: InputObject) on FIELD_DEFINITION
      directive @b(arg: InputObject) on INPUT_FIELD_DEFINITION

      input InputObject {
        field: String @b
      }
    `).toDeepEqual([
      {
        message:
          'Directive "@b" forms a reference cycle through: "@b(arg:)", "InputObject", "InputObject.field", directive application "@b".',
        locations: [
          { line: 3, column: 20 },
          { line: 3, column: 25 },
          { line: 6, column: 9 },
          { line: 6, column: 23 },
        ],
      },
    ]);
  });

  it('accepts explicit specified directive lists without AST directive nodes', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: { type: GraphQLString },
        },
      }),
      directives: [...specifiedDirectives],
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [NoDirectiveDefinitionCyclesTypeSystemValidation],
      }),
    ).toDeepEqual([]);
  });

  it('checks intrinsic specifiedBy and oneOf directive property names', () => {
    const Url = new GraphQLScalarType({
      name: 'Url',
      specifiedByURL: 'https://example.com/url',
    });
    const Input = new GraphQLInputObjectType({
      name: 'Input',
      isOneOf: true,
      fields: {
        value: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: { type: GraphQLString },
        },
      }),
      types: [Url, Input],
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [NoDirectiveDefinitionCyclesTypeSystemValidation],
      }),
    ).toDeepEqual([]);
  });

  it('checks actual specified directives when they have AST directive nodes', () => {
    const directiveNode = parse(`
      directive @deprecated @tag on FIELD_DEFINITION
    `).definitions[0] as DirectiveDefinitionNode;
    const previousAstNode = GraphQLDeprecatedDirective.astNode;

    try {
      GraphQLDeprecatedDirective.astNode = directiveNode;
      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            field: { type: GraphQLString },
          },
        }),
        directives: [GraphQLDeprecatedDirective],
      });

      expectJSON(
        validateWithRules({
          schema,
          typeSystemRules: [NoDirectiveDefinitionCyclesTypeSystemValidation],
        }),
      ).toDeepEqual([]);
    } finally {
      GraphQLDeprecatedDirective.astNode = previousAstNode;
    }
  });

  it('checks actual specified directives when their arguments have AST directive nodes', () => {
    const directiveNode = parse(`
      directive @deprecated(reason: String @tag) on FIELD_DEFINITION
    `).definitions[0] as DirectiveDefinitionNode;
    const argumentNode = directiveNode.arguments?.[0];
    if (argumentNode == null) {
      throw new Error('Expected directive argument node.');
    }
    const argument = GraphQLDeprecatedDirective.args[0];
    const previousAstNode = argument.astNode;

    try {
      argument.astNode = argumentNode;
      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            field: { type: GraphQLString },
          },
        }),
        directives: [GraphQLDeprecatedDirective],
      });

      expectJSON(
        validateWithRules({
          schema,
          typeSystemRules: [NoDirectiveDefinitionCyclesTypeSystemValidation],
        }),
      ).toDeepEqual([]);
    } finally {
      argument.astNode = previousAstNode;
    }
  });

  it('treats replacement directives with specified names as the same directive', () => {
    const Scalar = new GraphQLScalarType({
      name: 'Scalar',
      specifiedByURL: 'https://example.com/scalar',
    });
    const Input = new GraphQLInputObjectType({
      name: 'Input',
      fields: {
        self: { type: Scalar },
      },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: {
            type: GraphQLString,
            args: { input: { type: Input } },
          },
        },
      }),
      types: [Input, Scalar],
      directives: [
        new GraphQLDirective({
          name: 'specifiedBy',
          locations: [DirectiveLocation.SCALAR],
          args: { input: { type: Input } },
        }),
      ],
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [NoDirectiveDefinitionCyclesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message:
          'Directive "@specifiedBy" forms a reference cycle through: "@specifiedBy(input:)", "Input", "Input.self", "Scalar", directive application "@specifiedBy".',
      },
    ]);
  });

  it('treats replacement oneOf directives with specified names as the same directive', () => {
    const Input: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'Input',
      isOneOf: true,
      fields: () => ({
        self: { type: Input },
      }),
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: {
            type: GraphQLString,
            args: { input: { type: Input } },
          },
        },
      }),
      directives: [
        new GraphQLDirective({
          name: 'oneOf',
          locations: [DirectiveLocation.INPUT_OBJECT],
          args: { input: { type: Input } },
        }),
      ],
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [NoDirectiveDefinitionCyclesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message:
          'Directive "@oneOf" forms a reference cycle through: "@oneOf(input:)", "Input", directive application "@oneOf".',
      },
    ]);
  });

  it('rejects schema cycles through enum value deprecations', () => {
    const Color = new GraphQLEnumType({
      name: 'Color',
      values: {
        RED: {
          deprecationReason: 'old',
        },
      },
    });

    const Query = new GraphQLObjectType({
      name: 'Query',
      fields: {
        field: {
          type: GraphQLString,
          args: { color: { type: Color } },
        },
      },
    });

    const schema = new GraphQLSchema({
      query: Query,
      directives: [
        new GraphQLDirective({
          name: 'deprecated',
          locations: [DirectiveLocation.ENUM_VALUE],
          args: { color: { type: Color } },
        }),
        new GraphQLDirective({
          name: 'bad',
          locations: [DirectiveLocation.FIELD_DEFINITION],
          args: {
            // @ts-expect-error Testing defensive validation of invalid config.
            output: { type: Query },
          },
        }),
      ],
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [NoDirectiveDefinitionCyclesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message:
          'Directive "@deprecated" forms a reference cycle through: "@deprecated(color:)", "Color", "Color.RED", directive application "@deprecated".',
      },
    ]);
  });

  it('ignores existing schema-only directive cycles during document validation', () => {
    const Input: GraphQLInputObjectType = new GraphQLInputObjectType({
      name: 'Input',
      fields: () => ({
        self: {
          type: Input,
          deprecationReason: 'old',
        },
      }),
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: {
            type: GraphQLString,
            args: { input: { type: Input } },
          },
        },
      }),
      directives: [
        new GraphQLDirective({
          name: 'deprecated',
          locations: [DirectiveLocation.INPUT_FIELD_DEFINITION],
          args: { input: { type: Input } },
        }),
      ],
    });

    expectSDLErrorsWithSchema(
      'directive @noop on FIELD_DEFINITION',
      schema,
    ).toDeepEqual([]);
  });

  it('rejects schema cycles through SDL extensions of specified directives', () => {
    const schema = buildSchema('type Query { field: String }');
    const document = parse(`
      directive @cycle(arg: String @deprecated) on DIRECTIVE_DEFINITION
      extend directive @deprecated @cycle
    `);

    expectJSON(
      validateWithRules({
        schema: extendSchema(schema, document, { assumeValidSDL: true }),
        typeSystemRules: [NoDirectiveDefinitionCyclesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message:
          'Directive "@deprecated" forms a reference cycle through: directive application "@cycle", "@cycle(arg:)", directive application "@deprecated".',
        locations: [
          { line: 3, column: 36 },
          { line: 2, column: 24 },
          { line: 2, column: 36 },
        ],
      },
    ]);
  });

  it('checks specified directive argument AST directive nodes', () => {
    const directiveNode = parse(`
      directive @include(if: String @deprecated) on FIELD_DEFINITION
    `).definitions[0] as DirectiveDefinitionNode;
    const argumentNode = directiveNode.arguments?.[0];
    if (argumentNode == null) {
      throw new Error('Expected directive argument node.');
    }

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: { type: GraphQLString },
        },
      }),
      directives: [
        new GraphQLDirective({
          name: 'include',
          locations: [DirectiveLocation.FIELD_DEFINITION],
          args: {
            if: {
              type: GraphQLString,
              astNode: argumentNode,
            },
          },
        }),
      ],
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [NoDirectiveDefinitionCyclesTypeSystemValidation],
      }),
    ).toDeepEqual([]);
  });
});
