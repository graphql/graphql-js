import { describe, it } from 'node:test';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';

import { UniqueFieldDefinitionNamesTypeSystemValidation } from '../UniqueFieldDefinitionNamesRule.ts';

import { expectSDLRuleErrors } from './harness.ts';

describe('Validate: UniqueFieldDefinitionNamesRule', () => {
  it('validates SDL field definition names', () => {
    expectSDLRuleErrors(
      UniqueFieldDefinitionNamesTypeSystemValidation,
      `
        interface Empty
        type Query { field: String field: Int }
      `,
    ).toDeepEqual([
      { message: 'Field "Query.field" can only be defined once.' },
    ]);
  });

  it('rejects fields that already exist in the schema', () => {
    const schema = buildSchema(`
      scalar Text

      type Query {
        field: String
      }
    `);

    expectSDLRuleErrors(
      UniqueFieldDefinitionNamesTypeSystemValidation,
      `
        extend type Query {
          field: String
        }

        extend type Text {
          value: String
        }
      `,
      schema,
    ).toDeepEqual([
      {
        message:
          'Field "Query.field" already exists in the schema. It cannot also be defined in this type extension.',
      },
    ]);
  });
});
