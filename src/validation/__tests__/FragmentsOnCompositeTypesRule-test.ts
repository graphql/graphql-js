import { describe, it } from 'mocha';

import { FragmentsOnCompositeTypesRule } from '../rules/FragmentsOnCompositeTypesRule';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrors(FragmentsOnCompositeTypesRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

describe('Validate: Fragments on composite types', () => {
  it('object is valid fragment type', () => {
    expectValid(`
      fragment validFragment on Dog {
        barks
      }
    `);
  });

  it('interface is valid fragment type', () => {
    expectValid(`
      fragment validFragment on Pet {
        name
      }
    `);
  });

  it('object is valid inline fragment type', () => {
    expectValid(`
      fragment validFragment on Pet {
        ... on Dog {
          barks
        }
      }
    `);
  });

  it('interface is valid inline fragment type', () => {
    expectValid(`
      fragment validFragment on Mammal {
        ... on Canine {
          name
        }
      }
    `);
  });

  it('inline fragment without type is valid', () => {
    expectValid(`
      fragment validFragment on Pet {
        ... {
          name
        }
      }
    `);
  });

  it('union is valid fragment type', () => {
    expectValid(`
      fragment validFragment on CatOrDog {
        __typename
      }
    `);
  });

  it('scalar is invalid fragment type', () => {
    expectErrors(`
      fragment scalarFragment on Boolean {
        bad
      }
    `).toDeepEqual([
      {
        message:
          'Fragment "scalarFragment" cannot condition on non composite type "Boolean".',
        locations: [{ line: 2, column: 34 }],
      },
    ]);
  });

  it('enum is invalid fragment type', () => {
    expectErrors(`
      fragment scalarFragment on FurColor {
        bad
      }
    `).toDeepEqual([
      {
        message:
          'Fragment "scalarFragment" cannot condition on non composite type "FurColor".',
        locations: [{ line: 2, column: 34 }],
      },
    ]);
  });

  it('input object is invalid fragment type', () => {
    expectErrors(`
      fragment inputFragment on ComplexInput {
        stringField
      }
    `).toDeepEqual([
      {
        message:
          'Fragment "inputFragment" cannot condition on non composite type "ComplexInput".',
        locations: [{ line: 2, column: 33 }],
      },
    ]);
  });

  it('scalar is invalid inline fragment type', () => {
    expectErrors(`
      fragment invalidFragment on Pet {
        ... on String {
          barks
        }
      }
    `).toDeepEqual([
      {
        message: 'Fragment cannot condition on non composite type "String".',
        locations: [{ line: 3, column: 16 }],
      },
    ]);
  });
});
