import { describe, it } from 'mocha';

import { NoUnusedVariablesRule } from '../rules/NoUnusedVariablesRule';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrors(NoUnusedVariablesRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

describe('Validate: No unused variables', () => {
  it('uses all variables', () => {
    expectValid(`
      query ($a: String, $b: String, $c: String) {
        field(a: $a, b: $b, c: $c)
      }
    `);
  });

  it('uses all variables deeply', () => {
    expectValid(`
      query Foo($a: String, $b: String, $c: String) {
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
      query Foo($a: String, $b: String, $c: String) {
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

  it('uses all variables in fragments', () => {
    expectValid(`
      query Foo($a: String, $b: String, $c: String) {
        ...FragA
      }
      fragment FragA on Type {
        field(a: $a) {
          ...FragB
        }
      }
      fragment FragB on Type {
        field(b: $b) {
          ...FragC
        }
      }
      fragment FragC on Type {
        field(c: $c)
      }
    `);
  });

  it('variable used by fragment in multiple operations', () => {
    expectValid(`
      query Foo($a: String) {
        ...FragA
      }
      query Bar($b: String) {
        ...FragB
      }
      fragment FragA on Type {
        field(a: $a)
      }
      fragment FragB on Type {
        field(b: $b)
      }
    `);
  });

  it('variable used by recursive fragment', () => {
    expectValid(`
      query Foo($a: String) {
        ...FragA
      }
      fragment FragA on Type {
        field(a: $a) {
          ...FragA
        }
      }
    `);
  });

  it('variable not used', () => {
    expectErrors(`
      query ($a: String, $b: String, $c: String) {
        field(a: $a, b: $b)
      }
    `).toDeepEqual([
      {
        message: 'Variable "$c" is never used.',
        locations: [{ line: 2, column: 38 }],
      },
    ]);
  });

  it('multiple variables not used', () => {
    expectErrors(`
      query Foo($a: String, $b: String, $c: String) {
        field(b: $b)
      }
    `).toDeepEqual([
      {
        message: 'Variable "$a" is never used in operation "Foo".',
        locations: [{ line: 2, column: 17 }],
      },
      {
        message: 'Variable "$c" is never used in operation "Foo".',
        locations: [{ line: 2, column: 41 }],
      },
    ]);
  });

  it('variable not used in fragments', () => {
    expectErrors(`
      query Foo($a: String, $b: String, $c: String) {
        ...FragA
      }
      fragment FragA on Type {
        field(a: $a) {
          ...FragB
        }
      }
      fragment FragB on Type {
        field(b: $b) {
          ...FragC
        }
      }
      fragment FragC on Type {
        field
      }
    `).toDeepEqual([
      {
        message: 'Variable "$c" is never used in operation "Foo".',
        locations: [{ line: 2, column: 41 }],
      },
    ]);
  });

  it('multiple variables not used in fragments', () => {
    expectErrors(`
      query Foo($a: String, $b: String, $c: String) {
        ...FragA
      }
      fragment FragA on Type {
        field {
          ...FragB
        }
      }
      fragment FragB on Type {
        field(b: $b) {
          ...FragC
        }
      }
      fragment FragC on Type {
        field
      }
    `).toDeepEqual([
      {
        message: 'Variable "$a" is never used in operation "Foo".',
        locations: [{ line: 2, column: 17 }],
      },
      {
        message: 'Variable "$c" is never used in operation "Foo".',
        locations: [{ line: 2, column: 41 }],
      },
    ]);
  });

  it('variable not used by unreferenced fragment', () => {
    expectErrors(`
      query Foo($b: String) {
        ...FragA
      }
      fragment FragA on Type {
        field(a: $a)
      }
      fragment FragB on Type {
        field(b: $b)
      }
    `).toDeepEqual([
      {
        message: 'Variable "$b" is never used in operation "Foo".',
        locations: [{ line: 2, column: 17 }],
      },
    ]);
  });

  it('variable not used by fragment used by other operation', () => {
    expectErrors(`
      query Foo($b: String) {
        ...FragA
      }
      query Bar($a: String) {
        ...FragB
      }
      fragment FragA on Type {
        field(a: $a)
      }
      fragment FragB on Type {
        field(b: $b)
      }
    `).toDeepEqual([
      {
        message: 'Variable "$b" is never used in operation "Foo".',
        locations: [{ line: 2, column: 17 }],
      },
      {
        message: 'Variable "$a" is never used in operation "Bar".',
        locations: [{ line: 5, column: 17 }],
      },
    ]);
  });
});
