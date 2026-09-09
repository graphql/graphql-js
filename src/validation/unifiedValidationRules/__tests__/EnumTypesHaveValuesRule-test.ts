import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import { parse } from '../../../language/parser.ts';

import {
  GraphQLEnumType,
  GraphQLObjectType,
} from '../../../type/definition.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../index.ts';

import { EnumTypesHaveValuesTypeSystemValidation } from '../EnumTypesHaveValuesRule.ts';

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  const doc = parse(sdlStr);
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [EnumTypesHaveValuesTypeSystemValidation],
    schema,
  });
  return expectJSON(errors);
}

describe('Validate: EnumTypesHaveValuesRule', () => {
  it('validates SDL enum value counts after extensions are known', () => {
    expectSDLErrors(`
      enum Color
      extend enum Color {
        RED
      }
    `).toDeepEqual([]);
  });

  it('uses existing schema enum value counts when validating SDL', () => {
    const Color = new GraphQLEnumType({
      name: 'Color',
      values: { RED: {} },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: { color: { type: Color } },
      }),
    });

    expectSDLErrors(
      `
        extend enum Color {
          GREEN
        }
      `,
      schema,
    ).toDeepEqual([]);
  });

  it('rejects SDL enum types without values', () => {
    expectSDLErrors(`
      enum EmptyEnum
    `).toDeepEqual([
      {
        message: 'Enum type EmptyEnum must define one or more values.',
        locations: [{ line: 2, column: 7 }],
      },
    ]);
  });

  it('rejects schema enum types without values', () => {
    const EmptyEnum = new GraphQLEnumType({
      name: 'EmptyEnum',
      values: {},
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: { type: EmptyEnum },
        },
      }),
    });

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [EnumTypesHaveValuesTypeSystemValidation],
      }),
    ).toDeepEqual([
      { message: 'Enum type EmptyEnum must define one or more values.' },
    ]);
  });
});
