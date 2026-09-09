import { describe, it } from 'node:test';

import { UniqueInputFieldNamesASTVisitor } from '../UniqueInputFieldNamesRule.ts';

import { expectSDLRuleErrors } from './harness.ts';

describe('Validate: UniqueInputFieldNamesRule', () => {
  it('validates SDL input object value field names', () => {
    expectSDLRuleErrors(
      UniqueInputFieldNamesASTVisitor,
      `
        input Input { field: Int }
        type Query {
          field(arg: Input = { field: 1, field: 2 }): String
        }
      `,
    ).toDeepEqual([
      { message: 'There can be only one input field named "field".' },
    ]);
  });
});
