import { describe, it } from 'mocha';

import { NoUnusedFragmentVariablesRule } from '../rules/NoUnusedFragmentVariablesRule';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrors(NoUnusedFragmentVariablesRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

describe('Validate: No unused variables', () => {
  it('fragment defined arguments are not unused variables', () => {
    expectValid(`
      query Foo {
        ...FragA
      }
      fragment FragA($a: String) on Type {
        field1(a: $a)
      }
    `);
  });

  it('defined variables used as fragment arguments are not unused variables', () => {
    expectErrors(`
      query Foo($b: String) {
        ...FragA(a: $b)
      }
      fragment FragA($a: String) on Type {
        field1
      }
    `);
  });
});
