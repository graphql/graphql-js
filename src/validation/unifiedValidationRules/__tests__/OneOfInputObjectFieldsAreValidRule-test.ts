import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import type {
  ConstValueNode,
  InputObjectTypeDefinitionNode,
} from '../../../language/ast.ts';
import { parse, parseValue } from '../../../language/parser.ts';

import {
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
} from '../../../type/definition.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../index.ts';

import { OneOfInputObjectFieldsAreValidTypeSystemValidation } from '../OneOfInputObjectFieldsAreValidRule.ts';

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  const doc = parse(sdlStr, { noLocation: true });
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [OneOfInputObjectFieldsAreValidTypeSystemValidation],
    schema,
  });
  return expectJSON(errors);
}

function expectSDLErrorsWithLocations(sdlStr: string, schema?: GraphQLSchema) {
  const doc = parse(sdlStr);
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [OneOfInputObjectFieldsAreValidTypeSystemValidation],
    schema,
  });
  return expectJSON(errors);
}

describe('Validate: OneOfInputObjectFieldsAreValidRule', () => {
  it('rejects non-null SDL OneOf input fields and defaults', () => {
    expectSDLErrors(`
      input Choice @oneOf {
        required: String!
        defaulted: String = "value"
      }

      input Plain {
        required: String!
        defaulted: String = "value"
      }
    `).toDeepEqual([
      { message: 'OneOf input field Choice.required must be nullable.' },
      {
        message:
          'OneOf input field Choice.defaulted cannot have a default value.',
      },
    ]);
  });

  it('reports SDL OneOf field errors on the invalid type and default value', () => {
    expectSDLErrorsWithLocations(`
      input Choice @oneOf {
        required: String!
        defaulted: String = "value"
      }
    `).toDeepEqual([
      {
        message: 'OneOf input field Choice.required must be nullable.',
        locations: [{ line: 3, column: 19 }],
      },
      {
        message:
          'OneOf input field Choice.defaulted cannot have a default value.',
        locations: [{ line: 4, column: 29 }],
      },
    ]);
  });

  it('uses OneOf status from input object definitions and existing schema', () => {
    const Existing = new GraphQLInputObjectType({
      name: 'Existing',
      isOneOf: true,
      fields: {
        field: { type: GraphQLString },
      },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: {
            type: GraphQLString,
            args: { arg: { type: Existing } },
          },
        },
      }),
    });

    expectSDLErrors(
      `
        input Extended
        input Marked @oneOf
        extend input Marked {
          required: String!
        }

        extend input Existing {
          defaulted: String = "value"
        }
      `,
      schema,
    ).toDeepEqual([
      { message: 'OneOf input field Marked.required must be nullable.' },
      {
        message:
          'OneOf input field Existing.defaulted cannot have a default value.',
      },
    ]);
  });

  it('uses later SDL OneOf definitions when validating earlier extensions', () => {
    expectSDLErrors(`
      extend input Choice {
        required: String!
        defaulted: String = "value"
      }

      input Choice @oneOf {
        optional: String
      }
    `).toDeepEqual([
      { message: 'OneOf input field Choice.required must be nullable.' },
      {
        message:
          'OneOf input field Choice.defaulted cannot have a default value.',
      },
    ]);
  });

  it('does not use OneOf status from input object extension directives', () => {
    expectSDLErrors(`
      input Extended

      extend input Extended @oneOf {
        required: String!
        defaulted: String = "value"
      }
    `).toDeepEqual([]);
  });

  it('rejects non-null schema OneOf input fields and defaults', () => {
    const choiceDefinition = parse(
      `
        input Choice {
          required: String!
          defaulted: String = "value"
        }
      `,
      { noLocation: true },
    ).definitions[0] as InputObjectTypeDefinitionNode;
    const requiredNode = choiceDefinition.fields?.[0];
    const defaultedNode = choiceDefinition.fields?.[1];
    if (requiredNode == null || defaultedNode == null) {
      throw new Error('Expected input field nodes.');
    }

    const Choice = new GraphQLInputObjectType({
      name: 'Choice',
      isOneOf: true,
      fields: {
        required: {
          type: new GraphQLNonNull(GraphQLString),
          astNode: requiredNode,
        },
        defaulted: {
          type: GraphQLString,
          default: { value: 'value' },
          astNode: defaultedNode,
        },
        literalDefaulted: {
          type: GraphQLString,
          default: {
            literal: parseValue('"value"', {
              noLocation: true,
            }) as ConstValueNode,
          },
        },
        requiredWithoutAST: {
          type: new GraphQLNonNull(GraphQLString),
        },
        defaultedWithoutAST: {
          type: GraphQLString,
          default: { value: 'value' },
        },
      },
    });
    const Plain = new GraphQLInputObjectType({
      name: 'Plain',
      fields: {
        defaulted: { type: GraphQLString, default: { value: 'value' } },
      },
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: {
            type: GraphQLString,
            args: {
              choice: { type: Choice },
              plain: { type: Plain },
            },
          },
        },
      }),
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [OneOfInputObjectFieldsAreValidTypeSystemValidation],
      }),
    ).toDeepEqual([
      { message: 'OneOf input field Choice.required must be nullable.' },
      {
        message:
          'OneOf input field Choice.defaulted cannot have a default value.',
      },
      {
        message:
          'OneOf input field Choice.literalDefaulted cannot have a default value.',
      },
      {
        message:
          'OneOf input field Choice.requiredWithoutAST must be nullable.',
      },
      {
        message:
          'OneOf input field Choice.defaultedWithoutAST cannot have a default value.',
      },
    ]);
  });
});
