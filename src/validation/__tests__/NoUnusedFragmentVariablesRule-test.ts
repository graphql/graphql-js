import { describe, it } from 'mocha';

import { NoUnusedFragmentVariablesRule } from '../rules/NoUnusedFragmentVariablesRule.js';

import { expectValidationErrors } from './harness.js';

function expectErrors(queryStr: string) {
  return expectValidationErrors(NoUnusedFragmentVariablesRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

describe('Validate: No unused fragment variables', () => {
  it('uses all variables', () => {
    expectValid(`
      fragment Foo($a: String, $b: String, $c: String) on Type {
        field(a: $a, b: $b, c: $c)
      }
    `);
  });

  it('uses all variables deeply', () => {
    expectValid(`
      fragment Foo($a: String, $b: String, $c: String) on Type {
        field(a: $a) {
          field(b: $b) {
            field(c: $c)
          }
        }
      }
    `);
  });

  it('uses all variables deeply in inline fragments', () => {
    expectValid(`
      fragment Foo($a: String, $b: String, $c: String) on Type {
        ... on Type {
          field(a: $a) {
            field(b: $b) {
              ... on Type {
                field(c: $c)
              }
            }
          }
        }
      }
    `);
  });

  it('variable not used', () => {
    expectErrors(`
      fragment Foo($a: String, $b: String, $c: String) on Type {
        field(a: $a, b: $b)
      }
    `).toDeepEqual([
      {
        message: 'Variable "$c" is never used in fragment "Foo".',
        locations: [{ line: 2, column: 44 }],
      },
    ]);
  });

  it('query passes argument for unused variable', () => {
    expectErrors(`
      query Q($c: String) {
        type {
          ...Foo(a: "", b: "", c: $c)
        }
      }
      fragment Foo($a: String, $b: String, $c: String) on Type {
        field(a: $a, b: $b)
      }
    `).toDeepEqual([
      {
        message: 'Variable "$c" is never used in fragment "Foo".',
        locations: [{ line: 7, column: 44 }],
      },
    ]);
  });

  it('child fragment uses a variable of the same name', () => {
    expectErrors(`
      query Q($a: String) {
        type {
          ...Foo
        }
      }
      fragment Foo($a: String) on Type {
        ...Bar
      }
      fragment Bar on Type {
        field(a: $a)
      }
    `).toDeepEqual([
      {
        message: 'Variable "$a" is never used in fragment "Foo".',
        locations: [{ line: 7, column: 20 }],
      },
    ]);
  });

  it('multiple variables not used', () => {
    expectErrors(`
      fragment Foo($a: String, $b: String, $c: String) on Type {
        field(b: $b)
      }
    `).toDeepEqual([
      {
        message: 'Variable "$a" is never used in fragment "Foo".',
        locations: [{ line: 2, column: 20 }],
      },
      {
        message: 'Variable "$c" is never used in fragment "Foo".',
        locations: [{ line: 2, column: 44 }],
      },
    ]);
  });
});
