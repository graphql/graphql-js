import { describe, it } from 'mocha';

import { KnownOperationTypesRule } from '../rules/KnownOperationTypesRule.js';

import { expectValidationErrors } from './harness.js';

function expectErrors(queryStr: string) {
  return expectValidationErrors(KnownOperationTypesRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

describe('Validate: Known operation types', () => {
  it('one known operation', () => {
    expectValid(`
      { field }
    `);
  });

  it('unknown mutation operation', () => {
    expectErrors(`
      mutation { field }
    `).toDeepEqual([
      {
        message: 'The mutation operation is not supported by the schema.',
        locations: [{ line: 2, column: 7 }],
      },
    ]);
  });

  it('unknown subscription operation', () => {
    expectErrors(`
      subscription { field }
    `).toDeepEqual([
      {
        message: 'The subscription operation is not supported by the schema.',
        locations: [{ line: 2, column: 7 }],
      },
    ]);
  });

  it('mixture of known and unknown operations', () => {
    expectErrors(`
      query { field }
      mutation { field }
      subscription { field }
  `).toDeepEqual([
      {
        message: 'The mutation operation is not supported by the schema.',
        locations: [{ line: 3, column: 7 }],
      },
      {
        message: 'The subscription operation is not supported by the schema.',
        locations: [{ line: 4, column: 7 }],
      },
    ]);
  });
});
