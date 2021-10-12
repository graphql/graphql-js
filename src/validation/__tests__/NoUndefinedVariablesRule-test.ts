import { describe, it } from 'mocha';

import { NoUndefinedVariablesRule } from '../rules/NoUndefinedVariablesRule';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrors(NoUndefinedVariablesRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

describe('Validate: No undefined variables', () => {
  it('all variables defined', () => {
    expectValid(`
      query Foo($a: String, $b: String, $c: String) {
        field(a: $a, b: $b, c: $c)
      }
    `);
  });

  it('all variables deeply defined', () => {
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

  it('all variables deeply in inline fragments defined', () => {
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

  it('all variables in fragments deeply defined', () => {
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

  it('variable within single fragment defined in multiple operations', () => {
    expectValid(`
      query Foo($a: String) {
        ...FragA
      }
      query Bar($a: String) {
        ...FragA
      }
      fragment FragA on Type {
        field(a: $a)
      }
    `);
  });

  it('variable within fragments defined in operations', () => {
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

  it('variable within recursive fragment defined', () => {
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

  it('variable not defined', () => {
    expectErrors(`
      query Foo($a: String, $b: String, $c: String) {
        field(a: $a, b: $b, c: $c, d: $d)
      }
    `).toDeepEqual([
      {
        message: 'Variable "$d" is not defined by operation "Foo".',
        locations: [
          { line: 3, column: 39 },
          { line: 2, column: 7 },
        ],
      },
    ]);
  });

  it('variable not defined by un-named query', () => {
    expectErrors(`
      {
        field(a: $a)
      }
    `).toDeepEqual([
      {
        message: 'Variable "$a" is not defined.',
        locations: [
          { line: 3, column: 18 },
          { line: 2, column: 7 },
        ],
      },
    ]);
  });

  it('multiple variables not defined', () => {
    expectErrors(`
      query Foo($b: String) {
        field(a: $a, b: $b, c: $c)
      }
    `).toDeepEqual([
      {
        message: 'Variable "$a" is not defined by operation "Foo".',
        locations: [
          { line: 3, column: 18 },
          { line: 2, column: 7 },
        ],
      },
      {
        message: 'Variable "$c" is not defined by operation "Foo".',
        locations: [
          { line: 3, column: 32 },
          { line: 2, column: 7 },
        ],
      },
    ]);
  });

  it('variable in fragment not defined by un-named query', () => {
    expectErrors(`
      {
        ...FragA
      }
      fragment FragA on Type {
        field(a: $a)
      }
    `).toDeepEqual([
      {
        message: 'Variable "$a" is not defined.',
        locations: [
          { line: 6, column: 18 },
          { line: 2, column: 7 },
        ],
      },
    ]);
  });

  it('variable in fragment not defined by operation', () => {
    expectErrors(`
      query Foo($a: String, $b: String) {
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
    `).toDeepEqual([
      {
        message: 'Variable "$c" is not defined by operation "Foo".',
        locations: [
          { line: 16, column: 18 },
          { line: 2, column: 7 },
        ],
      },
    ]);
  });

  it('multiple variables in fragments not defined', () => {
    expectErrors(`
      query Foo($b: String) {
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
    `).toDeepEqual([
      {
        message: 'Variable "$a" is not defined by operation "Foo".',
        locations: [
          { line: 6, column: 18 },
          { line: 2, column: 7 },
        ],
      },
      {
        message: 'Variable "$c" is not defined by operation "Foo".',
        locations: [
          { line: 16, column: 18 },
          { line: 2, column: 7 },
        ],
      },
    ]);
  });

  it('single variable in fragment not defined by multiple operations', () => {
    expectErrors(`
      query Foo($a: String) {
        ...FragAB
      }
      query Bar($a: String) {
        ...FragAB
      }
      fragment FragAB on Type {
        field(a: $a, b: $b)
      }
    `).toDeepEqual([
      {
        message: 'Variable "$b" is not defined by operation "Foo".',
        locations: [
          { line: 9, column: 25 },
          { line: 2, column: 7 },
        ],
      },
      {
        message: 'Variable "$b" is not defined by operation "Bar".',
        locations: [
          { line: 9, column: 25 },
          { line: 5, column: 7 },
        ],
      },
    ]);
  });

  it('variables in fragment not defined by multiple operations', () => {
    expectErrors(`
      query Foo($b: String) {
        ...FragAB
      }
      query Bar($a: String) {
        ...FragAB
      }
      fragment FragAB on Type {
        field(a: $a, b: $b)
      }
    `).toDeepEqual([
      {
        message: 'Variable "$a" is not defined by operation "Foo".',
        locations: [
          { line: 9, column: 18 },
          { line: 2, column: 7 },
        ],
      },
      {
        message: 'Variable "$b" is not defined by operation "Bar".',
        locations: [
          { line: 9, column: 25 },
          { line: 5, column: 7 },
        ],
      },
    ]);
  });

  it('variable in fragment used by other operation', () => {
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
        message: 'Variable "$a" is not defined by operation "Foo".',
        locations: [
          { line: 9, column: 18 },
          { line: 2, column: 7 },
        ],
      },
      {
        message: 'Variable "$b" is not defined by operation "Bar".',
        locations: [
          { line: 12, column: 18 },
          { line: 5, column: 7 },
        ],
      },
    ]);
  });

  it('multiple undefined variables produce multiple errors', () => {
    expectErrors(`
      query Foo($b: String) {
        ...FragAB
      }
      query Bar($a: String) {
        ...FragAB
      }
      fragment FragAB on Type {
        field1(a: $a, b: $b)
        ...FragC
        field3(a: $a, b: $b)
      }
      fragment FragC on Type {
        field2(c: $c)
      }
    `).toDeepEqual([
      {
        message: 'Variable "$a" is not defined by operation "Foo".',
        locations: [
          { line: 9, column: 19 },
          { line: 2, column: 7 },
        ],
      },
      {
        message: 'Variable "$a" is not defined by operation "Foo".',
        locations: [
          { line: 11, column: 19 },
          { line: 2, column: 7 },
        ],
      },
      {
        message: 'Variable "$c" is not defined by operation "Foo".',
        locations: [
          { line: 14, column: 19 },
          { line: 2, column: 7 },
        ],
      },
      {
        message: 'Variable "$b" is not defined by operation "Bar".',
        locations: [
          { line: 9, column: 26 },
          { line: 5, column: 7 },
        ],
      },
      {
        message: 'Variable "$b" is not defined by operation "Bar".',
        locations: [
          { line: 11, column: 26 },
          { line: 5, column: 7 },
        ],
      },
      {
        message: 'Variable "$c" is not defined by operation "Bar".',
        locations: [
          { line: 14, column: 19 },
          { line: 5, column: 7 },
        ],
      },
    ]);
  });
});
