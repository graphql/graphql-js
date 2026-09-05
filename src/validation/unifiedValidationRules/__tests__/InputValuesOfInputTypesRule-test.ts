import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import type { ObjectTypeDefinitionNode } from '../../../language/ast.ts';
import { DirectiveLocation } from '../../../language/directiveLocation.ts';
import { parse } from '../../../language/parser.ts';

import {
  GraphQLInputObjectType,
  GraphQLObjectType,
} from '../../../type/definition.ts';
import { GraphQLDirective } from '../../../type/directives.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../index.ts';

import { InputValuesOfInputTypesTypeSystemValidation } from '../InputValuesOfInputTypesRule.ts';

function expectSDLErrors(sdlStr: string) {
  const doc = parse(sdlStr);
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [InputValuesOfInputTypesTypeSystemValidation],
  });
  return expectJSON(errors);
}

describe('Validate: InputValuesOfInputTypesRule', () => {
  it('rejects SDL input value definitions with output types', () => {
    expectSDLErrors(`
      type Output {
        field: String
      }

      type Object {
        field(arg: Output): String
      }

      extend type Object {
        other(arg: Output): String
      }

      interface Interface {
        field(arg: Output): String
      }

      extend interface Interface {
        other(arg: Output): String
      }

      input Input {
        field: Output
      }

      extend input Input {
        other: Output
      }
    `).toDeepEqual([
      {
        message:
          'The type of Object.field(arg:) must be Input Type but got: Output.',
        locations: [{ line: 7, column: 20 }],
      },
      {
        message:
          'The type of Object.other(arg:) must be Input Type but got: Output.',
        locations: [{ line: 11, column: 20 }],
      },
      {
        message:
          'The type of Interface.field(arg:) must be Input Type but got: Output.',
        locations: [{ line: 15, column: 20 }],
      },
      {
        message:
          'The type of Interface.other(arg:) must be Input Type but got: Output.',
        locations: [{ line: 19, column: 20 }],
      },
      {
        message: 'The type of Input.field must be Input Type but got: Output.',
        locations: [{ line: 23, column: 16 }],
      },
      {
        message: 'The type of Input.other must be Input Type but got: Output.',
        locations: [{ line: 27, column: 16 }],
      },
    ]);
  });

  it('ignores unknown types', () => {
    expectSDLErrors(`
      type Output {
        field: String
      }

      type Query {
        field(arg: Missing): String
      }
    `).toDeepEqual([]);
  });

  it('rejects duplicated type names when any candidate is not an input type', () => {
    expectSDLErrors(`
      input Ambiguous {
        value: String
      }

      type Ambiguous {
        value: String
      }

      type Query {
        field(arg: Ambiguous): String
      }
    `).toDeepEqual([
      {
        message:
          'The type of Query.field(arg:) must be Input Type but got: Ambiguous.',
        locations: [{ line: 11, column: 20 }],
      },
    ]);
  });

  it('rejects SDL directive arguments with output types', () => {
    expectSDLErrors(`
      type Output {
        field: String
      }

      directive @tag on SCALAR

      scalar Custom
      extend scalar Custom @tag

      directive @bad(arg: [Output!]!) on FIELD_DEFINITION
    `).toDeepEqual([
      {
        message:
          'The type of @bad(arg:) must be Input Type but got: [Output!]!.',
        locations: [{ line: 11, column: 27 }],
      },
    ]);
  });

  it('accepts directive-only extensions without input value definitions', () => {
    expectSDLErrors(`
      directive @tag on OBJECT | INTERFACE | INPUT_OBJECT

      extend type Object @tag
      extend interface Interface @tag
      extend input Input @tag
    `).toDeepEqual([]);
  });

  it('rejects schema input values with output types', () => {
    const queryNode = parse('type Query { field(arg: Output): String }')
      .definitions[0] as ObjectTypeDefinitionNode;
    const argNode = queryNode.fields?.[0].arguments?.[0];
    if (argNode == null) {
      throw new Error('Expected argument node.');
    }

    const Output = new GraphQLObjectType({
      name: 'Output',
      fields: { field: { type: GraphQLString } },
    });
    const Input = new GraphQLInputObjectType({
      name: 'Input',
      fields: {
        field: {
          // @ts-expect-error Testing defensive validation of invalid config.
          type: Output,
        },
      },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: {
            type: GraphQLString,
            args: {
              arg: {
                // @ts-expect-error Testing defensive validation of invalid config.
                type: Output,
                astNode: argNode,
              },
            },
          },
        },
      }),
      types: [Input],
      directives: [
        new GraphQLDirective({
          name: 'tag',
          locations: [DirectiveLocation.FIELD_DEFINITION],
          args: {
            arg: {
              // @ts-expect-error Testing defensive validation of invalid config.
              type: Output,
            },
          },
        }),
      ],
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [InputValuesOfInputTypesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message: 'The type of @tag(arg:) must be Input Type but got: Output.',
      },
      {
        message: 'The type of Input.field must be Input Type but got: Output.',
      },
      {
        message:
          'The type of Query.field(arg:) must be Input Type but got: Output.',
        locations: [{ line: 1, column: 25 }],
      },
    ]);
  });
});
