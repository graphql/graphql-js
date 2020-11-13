import { describe, it } from 'mocha';

import { VariablesAreInputTypesRule } from '../rules/VariablesAreInputTypesRule';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrors(VariablesAreInputTypesRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).to.deep.equal([]);
}

describe('Validate: Variables are input types', () => {
  it('input types are valid', () => {
    expectValid(`
      query Foo($a: String, $b: [Boolean!]!, $c: ComplexInput) {
        field(a: $a, b: $b, c: $c)
      }
    `);
  });

  it('output types are invalid', () => {
    expectErrors(`
      query Foo($a: Dog, $b: [[CatOrDog!]]!, $c: Pet) {
        field(a: $a, b: $b, c: $c)
      }
    `).to.deep.equal([
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
});
