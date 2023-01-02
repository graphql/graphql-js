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
  it('uses all arguments', () => {
    expectValid(`
      fragment Foo($a: String, $b: String, $c: String) on Type {
        field(a: $a, b: $b, c: $c)
      }
    `);
  });

  it('uses all arguments deeply', () => {
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

  it('uses all arguments deeply in inline fragments', () => {
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

  it('argument not used', () => {
    expectErrors(`
      fragment Foo($a: String, $b: String, $c: String) on Type {
        field(a: $a, b: $b)
      }
    `).toDeepEqual([
      {
        message: 'Argument "$c" is never used in fragment "Foo".',
        locations: [{ line: 2, column: 44 }],
      },
    ]);
  });

  it('query passes in unused argument', () => {
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
        message: 'Argument "$c" is never used in fragment "Foo".',
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
        message: 'Argument "$a" is never used in fragment "Foo".',
        locations: [{ line: 7, column: 20 }],
      },
    ]);
  });

  it('multiple arguments not used', () => {
    expectErrors(`
      fragment Foo($a: String, $b: String, $c: String) on Type {
        field(b: $b)
      }
    `).toDeepEqual([
      {
        message: 'Argument "$a" is never used in fragment "Foo".',
        locations: [{ line: 2, column: 20 }],
      },
      {
        message: 'Argument "$c" is never used in fragment "Foo".',
        locations: [{ line: 2, column: 44 }],
      },
    ]);
  });
});
