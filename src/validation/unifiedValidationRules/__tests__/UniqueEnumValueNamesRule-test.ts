import { describe, it } from 'node:test';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';

import { UniqueEnumValueNamesTypeSystemValidation } from '../UniqueEnumValueNamesRule.ts';

import { expectSDLRuleErrors } from './harness.ts';

describe('Validate: UniqueEnumValueNamesRule', () => {
  it('validates SDL enum value names', () => {
    expectSDLRuleErrors(
      UniqueEnumValueNamesTypeSystemValidation,
      `
        enum Empty
        enum Enum { VALUE VALUE }
        type Query { field: Enum }
      `,
    ).toDeepEqual([
      { message: 'Enum value "Enum.VALUE" can only be defined once.' },
    ]);
  });

  it('rejects enum values that already exist in the schema', () => {
    const schema = buildSchema(`
      enum Color {
        RED
      }

      type Query {
        color: Color
      }
    `);

    expectSDLRuleErrors(
      UniqueEnumValueNamesTypeSystemValidation,
      'extend enum Color { RED }',
      schema,
    ).toDeepEqual([
      {
        message:
          'Enum value "Color.RED" already exists in the schema. It cannot also be defined in this type extension.',
      },
    ]);
  });
});
