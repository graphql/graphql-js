import { describe, it } from 'mocha';

import { NoUnusedFragmentArgumentsRule } from '../rules/NoUnusedFragmentArgumentsRule.js';

import { expectValidationErrors } from './harness.js';

function expectErrors(queryStr: string) {
  return expectValidationErrors(NoUnusedFragmentArgumentsRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

describe('Validate: No unused fragment arguments', () => {
  it('allows used fragment arguments', () => {
    expectValid(`
      query Foo {
        ...FragA(a: "value")
      }
      fragment FragA($a: String) on Type {
        field1(a: $a)
      }
    `);
  });

  it('reports errors with unused fragment arguments', () => {
    expectErrors(`
      query Foo($b: String) {
        ...FragA
      }
      fragment FragA($a: String) on Type {
        field1(a: $a)
      }
    `).toDeepEqual([
      {
        message: 'Fragment argument "a" is not used.',
        locations: [{ line: 5, column: 22 }],
      },
    ]);
  });
});
