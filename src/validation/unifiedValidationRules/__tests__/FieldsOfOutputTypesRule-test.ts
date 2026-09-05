import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import type { ObjectTypeDefinitionNode } from '../../../language/ast.ts';
import { parse } from '../../../language/parser.ts';

import {
  GraphQLInputObjectType,
  GraphQLObjectType,
} from '../../../type/definition.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../index.ts';

import { FieldsOfOutputTypesTypeSystemValidation } from '../FieldsOfOutputTypesRule.ts';

function expectSDLErrors(sdlStr: string) {
  const doc = parse(sdlStr);
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [FieldsOfOutputTypesTypeSystemValidation],
  });
  return expectJSON(errors);
}

describe('Validate: FieldsOfOutputTypesRule', () => {
  it('rejects SDL object and interface fields with input types', () => {
    expectSDLErrors(`
      input Input {
        field: String
      }

      type Object {
        bad: Input
      }

      extend type Object {
        alsoBad: Input
      }

      interface Interface {
        bad: Input
      }

      extend interface Interface {
        alsoBad: Input
      }
    `).toDeepEqual([
      {
        message: 'The type of Object.bad must be Output Type but got: Input.',
        locations: [{ line: 7, column: 14 }],
      },
      {
        message:
          'The type of Object.alsoBad must be Output Type but got: Input.',
        locations: [{ line: 11, column: 18 }],
      },
      {
        message:
          'The type of Interface.bad must be Output Type but got: Input.',
        locations: [{ line: 15, column: 14 }],
      },
      {
        message:
          'The type of Interface.alsoBad must be Output Type but got: Input.',
        locations: [{ line: 19, column: 18 }],
      },
    ]);
  });

  it('rejects duplicated type names when any candidate is not an output type', () => {
    expectSDLErrors(`
      type Ambiguous {
        value: String
      }

      input Ambiguous {
        value: String
      }

      type Query {
        field: Ambiguous
      }
    `).toDeepEqual([
      {
        message:
          'The type of Query.field must be Output Type but got: Ambiguous.',
        locations: [{ line: 11, column: 16 }],
      },
    ]);
  });

  it('accepts directive-only object and interface extensions', () => {
    expectSDLErrors(`
      directive @tag on OBJECT | INTERFACE

      extend type Object @tag
      extend interface Interface @tag
    `).toDeepEqual([]);
  });

  it('rejects schema fields with input types', () => {
    const Input = new GraphQLInputObjectType({
      name: 'Input',
      fields: { field: { type: GraphQLString } },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: {
            // @ts-expect-error Testing defensive validation of invalid config.
            type: Input,
            astNode: (
              parse('type Query { field: Input }')
                .definitions[0] as ObjectTypeDefinitionNode
            ).fields?.[0],
          },
        },
      }),
      types: [Input],
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [FieldsOfOutputTypesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message: 'The type of Query.field must be Output Type but got: Input.',
        locations: [{ line: 1, column: 21 }],
      },
    ]);
  });
});
