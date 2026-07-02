import { describe, it } from 'node:test';

import { PossibleSchemaExtensionsTypeSystemValidation } from '../PossibleSchemaExtensionsRule.ts';

import { expectSDLRuleErrors, schemaWithQuery } from './harness.ts';

describe('Validate: PossibleSchemaExtensionsRule', () => {
  it('rejects schema extensions without a schema definition', () => {
    expectSDLRuleErrors(
      PossibleSchemaExtensionsTypeSystemValidation,
      `
        directive @tag on SCHEMA

        extend schema @tag

        type Query { field: String }
      `,
    ).toDeepEqual([
      { message: 'Cannot extend schema because it is not defined.' },
    ]);
  });

  it('rejects operation type schema extensions without a schema definition', () => {
    expectSDLRuleErrors(
      PossibleSchemaExtensionsTypeSystemValidation,
      `
        extend schema { query: Query }

        type Query { field: String }
      `,
    ).toDeepEqual([
      { message: 'Cannot extend schema because it is not defined.' },
    ]);
  });

  it('allows schema extensions when the document defines a schema', () => {
    expectSDLRuleErrors(
      PossibleSchemaExtensionsTypeSystemValidation,
      `
        extend schema @tag

        schema { query: Query }

        directive @tag on SCHEMA

        type Query { field: String }
      `,
    ).toDeepEqual([]);
  });

  it('allows schema extensions when extending an existing schema', () => {
    expectSDLRuleErrors(
      PossibleSchemaExtensionsTypeSystemValidation,
      'extend schema @tag',
      schemaWithQuery(),
    ).toDeepEqual([]);
  });
});
