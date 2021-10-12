import { describe, it } from 'mocha';

import { ExecutableDefinitionsRule } from '../rules/ExecutableDefinitionsRule';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrors(ExecutableDefinitionsRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

describe('Validate: Executable definitions', () => {
  it('with only operation', () => {
    expectValid(`
      query Foo {
        dog {
          name
        }
      }
    `);
  });

  it('with operation and fragment', () => {
    expectValid(`
      query Foo {
        dog {
          name
          ...Frag
        }
      }

      fragment Frag on Dog {
        name
      }
    `);
  });

  it('with type definition', () => {
    expectErrors(`
      query Foo {
        dog {
          name
        }
      }

      type Cow {
        name: String
      }

      extend type Dog {
        color: String
      }
    `).toDeepEqual([
      {
        message: 'The "Cow" definition is not executable.',
        locations: [{ line: 8, column: 7 }],
      },
      {
        message: 'The "Dog" definition is not executable.',
        locations: [{ line: 12, column: 7 }],
      },
    ]);
  });

  it('with schema definition', () => {
    expectErrors(`
      schema {
        query: Query
      }

      type Query {
        test: String
      }

      extend schema @directive
    `).toDeepEqual([
      {
        message: 'The schema definition is not executable.',
        locations: [{ line: 2, column: 7 }],
      },
      {
        message: 'The "Query" definition is not executable.',
        locations: [{ line: 6, column: 7 }],
      },
      {
        message: 'The schema definition is not executable.',
        locations: [{ line: 10, column: 7 }],
      },
    ]);
  });
});
