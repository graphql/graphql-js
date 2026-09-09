import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import type {
  DirectiveDefinitionNode,
  InputObjectTypeDefinitionNode,
  ObjectTypeDefinitionNode,
} from '../../../language/ast.ts';
import { DirectiveLocation } from '../../../language/directiveLocation.ts';
import { parse } from '../../../language/parser.ts';

import {
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
} from '../../../type/definition.ts';
import { GraphQLDirective } from '../../../type/directives.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../index.ts';

import { RequiredInputValuesCannotBeDeprecatedTypeSystemValidation } from '../RequiredInputValuesCannotBeDeprecatedRule.ts';

import { expectSchemaErrors } from './harness.ts';

function expectSDLErrors(sdlStr: string) {
  const doc = parse(sdlStr);
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [
      RequiredInputValuesCannotBeDeprecatedTypeSystemValidation,
    ],
  });
  return expectJSON(errors);
}

describe('Validate: RequiredInputValuesCannotBeDeprecatedRule', () => {
  it('rejects deprecated required SDL input values', () => {
    expectSDLErrors(`
      directive @bad(
        required: String! @deprecated
        optional: String @deprecated
        withDefault: String! = "value" @deprecated
      ) on FIELD_DEFINITION

      type Object {
        field(required: String! @deprecated): String
        optionalField(optional: String @deprecated): String
      }

      extend type Object {
        other(required: String! @deprecated): String
      }

      interface Interface {
        field(required: String! @deprecated): String
      }

      extend interface Interface {
        other(required: String! @deprecated): String
      }

      input Input {
        required: String! @deprecated
        optional: String @deprecated
      }

      extend input Input {
        other: String! @deprecated
        withDefault: String! = "value" @deprecated
      }
    `).toDeepEqual([
      {
        message: 'Required argument @bad(required:) cannot be deprecated.',
        locations: [
          { line: 3, column: 27 },
          { line: 3, column: 19 },
        ],
      },
      {
        message:
          'Required argument Object.field(required:) cannot be deprecated.',
        locations: [
          { line: 9, column: 33 },
          { line: 9, column: 25 },
        ],
      },
      {
        message:
          'Required argument Object.other(required:) cannot be deprecated.',
        locations: [
          { line: 14, column: 33 },
          { line: 14, column: 25 },
        ],
      },
      {
        message:
          'Required argument Interface.field(required:) cannot be deprecated.',
        locations: [
          { line: 18, column: 33 },
          { line: 18, column: 25 },
        ],
      },
      {
        message:
          'Required argument Interface.other(required:) cannot be deprecated.',
        locations: [
          { line: 22, column: 33 },
          { line: 22, column: 25 },
        ],
      },
      {
        message: 'Required input field Input.required cannot be deprecated.',
        locations: [
          { line: 26, column: 27 },
          { line: 26, column: 19 },
        ],
      },
      {
        message: 'Required input field Input.other cannot be deprecated.',
        locations: [
          { line: 31, column: 24 },
          { line: 31, column: 16 },
        ],
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

  it('ignores deprecated required SDL values with invalid input types', () => {
    expectSDLErrors(`
      type Output {
        field: String
      }

      directive @bad(required: Output! @deprecated) on FIELD_DEFINITION

      type Query {
        field(required: Output! @deprecated): String
      }

      input Input {
        required: Output! @deprecated
      }
    `).toDeepEqual([]);
  });

  it('accepts required SDL input values that are not deprecated', () => {
    expectSDLErrors(`
      directive @tag(required: String!) on FIELD_DEFINITION

      type Query {
        field(required: String!): String
      }

      input Input {
        required: String!
      }
    `).toDeepEqual([]);
  });

  it('rejects deprecated required schema input values', () => {
    const directiveDefinition = parse(
      'directive @tag(required: String! @deprecated) on FIELD_DEFINITION',
      { noLocation: true },
    ).definitions[0] as DirectiveDefinitionNode;
    const inputDefinition = parse(
      'input Input { required: String! @deprecated }',
      { noLocation: true },
    ).definitions[0] as InputObjectTypeDefinitionNode;
    const queryDefinition = parse(
      'type Query { field(required: String! @deprecated): String }',
      { noLocation: true },
    ).definitions[0] as ObjectTypeDefinitionNode;
    const directiveArgNode = directiveDefinition.arguments?.[0];
    const inputFieldNode = inputDefinition.fields?.[0];
    const queryArgNode = queryDefinition.fields?.[0].arguments?.[0];
    if (
      directiveArgNode == null ||
      inputFieldNode == null ||
      queryArgNode == null
    ) {
      throw new Error('Expected input value definition nodes.');
    }

    const Input = new GraphQLInputObjectType({
      name: 'Input',
      fields: {
        required: {
          type: new GraphQLNonNull(GraphQLString),
          deprecationReason: 'No longer used.',
          astNode: inputFieldNode,
        },
        optional: { type: GraphQLString },
      },
    });
    const Query = new GraphQLObjectType({
      name: 'Query',
      fields: {
        field: {
          type: GraphQLString,
          args: {
            required: {
              type: new GraphQLNonNull(GraphQLString),
              deprecationReason: 'No longer used.',
              astNode: queryArgNode,
            },
            optional: { type: GraphQLString },
          },
        },
      },
    });
    const directive = new GraphQLDirective({
      name: 'tag',
      locations: [DirectiveLocation.FIELD_DEFINITION],
      args: {
        required: {
          type: new GraphQLNonNull(GraphQLString),
          deprecationReason: 'No longer used.',
          astNode: directiveArgNode,
        },
      },
    });
    const schema = new GraphQLSchema({
      query: Query,
      types: [Input],
      directives: [directive],
    });

    expectSchemaErrors(
      schema,
      RequiredInputValuesCannotBeDeprecatedTypeSystemValidation,
    ).toDeepEqual([
      {
        message: 'Required argument @tag(required:) cannot be deprecated.',
      },
      {
        message: 'Required input field Input.required cannot be deprecated.',
      },
      {
        message:
          'Required argument Query.field(required:) cannot be deprecated.',
      },
    ]);
  });

  it('ignores deprecated required schema values with invalid input types', () => {
    const Output = new GraphQLObjectType({
      name: 'Output',
      fields: {
        field: { type: GraphQLString },
      },
    });
    const Input = new GraphQLInputObjectType({
      name: 'Input',
      fields: {
        required: {
          // @ts-expect-error Testing defensive validation of invalid config.
          type: new GraphQLNonNull(Output),
          deprecationReason: 'Invalid input type is reported by another rule.',
        },
      },
    });
    const Query = new GraphQLObjectType({
      name: 'Query',
      fields: {
        field: {
          type: GraphQLString,
          args: {
            required: {
              // @ts-expect-error Testing defensive validation of invalid config.
              type: new GraphQLNonNull(Output),
              deprecationReason:
                'Invalid input type is reported by another rule.',
            },
          },
        },
      },
    });
    const schema = new GraphQLSchema({ query: Query, types: [Input] });
    expectSchemaErrors(
      schema,
      RequiredInputValuesCannotBeDeprecatedTypeSystemValidation,
    ).toDeepEqual([]);
  });
});
