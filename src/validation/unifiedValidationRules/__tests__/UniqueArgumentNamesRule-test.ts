import { describe, it } from 'node:test';

import { UniqueArgumentNamesASTVisitor } from '../UniqueArgumentNamesRule.ts';

import { expectSDLRuleErrors } from './harness.ts';

describe('Validate: UniqueArgumentNamesRule', () => {
  it('accepts fields without duplicate arguments', () => {
    expectSDLRuleErrors(
      UniqueArgumentNamesASTVisitor,
      `
        type Query {
          field(arg: Int): String
        }

        query {
          field
          field(arg: 1)
        }
      `,
    ).toDeepEqual([]);
  });

  it('validates SDL directive argument uniqueness', () => {
    expectSDLRuleErrors(
      UniqueArgumentNamesASTVisitor,
      `
        directive @tag(arg: Int) on OBJECT
        type Query @tag(arg: 1, arg: 2) { field: String }
      `,
    ).toDeepEqual([{ message: 'There can be only one argument named "arg".' }]);
  });
});
