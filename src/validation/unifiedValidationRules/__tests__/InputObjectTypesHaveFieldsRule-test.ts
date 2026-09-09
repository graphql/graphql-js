import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import { parse } from '../../../language/parser.ts';

import {
  GraphQLInputObjectType,
  GraphQLObjectType,
} from '../../../type/definition.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../index.ts';

import { InputObjectTypesHaveFieldsTypeSystemValidation } from '../InputObjectTypesHaveFieldsRule.ts';

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  const doc = parse(sdlStr);
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [InputObjectTypesHaveFieldsTypeSystemValidation],
    schema,
  });
  return expectJSON(errors);
}

describe('Validate: InputObjectTypesHaveFieldsRule', () => {
  it('validates SDL input field counts after extensions are known', () => {
    expectSDLErrors(`
      input Input
      extend input Input {
        field: String
      }
    `).toDeepEqual([]);
  });

  it('uses existing schema input field counts when validating SDL', () => {
    const ExistingInput = new GraphQLInputObjectType({
      name: 'ExistingInput',
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
            args: { input: { type: ExistingInput } },
          },
        },
      }),
    });

    expectSDLErrors(
      'extend input ExistingInput { other: String }',
      schema,
    ).toDeepEqual([]);
  });

  it('rejects SDL input object types without fields', () => {
    expectSDLErrors(`
      input EmptyInput
    `).toDeepEqual([
      {
        message: 'Input Object type EmptyInput must define one or more fields.',
        locations: [{ line: 2, column: 7 }],
      },
    ]);
  });

  it('rejects schema input object types without fields', () => {
    const EmptyInput = new GraphQLInputObjectType({
      name: 'EmptyInput',
      fields: {},
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: {
            type: GraphQLString,
            args: { input: { type: EmptyInput } },
          },
        },
      }),
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [InputObjectTypesHaveFieldsTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message: 'Input Object type EmptyInput must define one or more fields.',
      },
    ]);
  });
});
