import { describe, it } from 'mocha';

import { VariablesAreInputTypesRule } from '../rules/VariablesAreInputTypesRule.js';

import { expectValidationErrors } from './harness.js';

function expectErrors(queryStr: string) {
  return expectValidationErrors(VariablesAreInputTypesRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

describe('Validate: Variables are input types', () => {
  it('unknown types are ignored', () => {
    expectValid(`
      query Foo($a: Unknown, $b: [[Unknown!]]!) {
        field(a: $a, b: $b)
      }
      fragment Bar($a: Unknown, $b: [[Unknown!]]!) on Query {
        field(a: $a, b: $b)
      }
    `);
  });

  it('input types are valid', () => {
    expectValid(`
      query Foo($a: String, $b: [Boolean!]!, $c: ComplexInput) {
        field(a: $a, b: $b, c: $c)
      }
      fragment Bar($a: String, $b: [Boolean!]!, $c: ComplexInput) on Query {
        field(a: $a, b: $b, c: $c)
      }
    `);
  });

  it('output types are invalid', () => {
    expectErrors(`
      query Foo($a: Dog, $b: [[CatOrDog!]]!, $c: Pet) {
        field(a: $a, b: $b, c: $c)
      }
    `).toDeepEqual([
      {
        locations: [{ line: 2, column: 21 }],
        message: 'Variable "$a" cannot be non-input type "Dog".',
      },
      {
        locations: [{ line: 2, column: 30 }],
        message: 'Variable "$b" cannot be non-input type "[[CatOrDog!]]!".',
      },
      {
        locations: [{ line: 2, column: 50 }],
        message: 'Variable "$c" cannot be non-input type "Pet".',
      },
    ]);
  });

  it('output types on fragment arguments are invalid', () => {
    expectErrors(`
      fragment Bar($a: Dog, $b: [[CatOrDog!]]!, $c: Pet) on Query {
        field(a: $a, b: $b, c: $c)
      }
    `).toDeepEqual([
      {
        locations: [{ line: 2, column: 24 }],
        message: 'Variable "$a" cannot be non-input type "Dog".',
      },
      {
        locations: [{ line: 2, column: 33 }],
        message: 'Variable "$b" cannot be non-input type "[[CatOrDog!]]!".',
      },
      {
        locations: [{ line: 2, column: 53 }],
        message: 'Variable "$c" cannot be non-input type "Pet".',
      },
    ]);
  });
});
