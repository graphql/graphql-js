import { describe, it } from 'node:test';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';

import { UniqueOperationTypesTypeSystemValidation } from '../UniqueOperationTypesRule.ts';

import { expectSDLRuleErrors } from './harness.ts';

describe('Validate: UniqueOperationTypesRule', () => {
  it('validates SDL root operation types', () => {
    expectSDLRuleErrors(
      UniqueOperationTypesTypeSystemValidation,
      `
        directive @tag on SCHEMA
        extend schema @tag

        schema { query: Query query: Query }
        type Query { field: String }
      `,
    ).toDeepEqual([{ message: 'There can be only one query type in schema.' }]);
  });

  it('rejects redefining existing schema root operation types', () => {
    const schema = buildSchema(`
      type Query {
        field: String
      }
    `);

    expectSDLRuleErrors(
      UniqueOperationTypesTypeSystemValidation,
      'extend schema { query: Query }',
      schema,
    ).toDeepEqual([
      {
        message:
          'Type for query already defined in the schema. It cannot be redefined.',
      },
    ]);
  });
});
