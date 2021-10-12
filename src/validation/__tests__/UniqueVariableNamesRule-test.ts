import { describe, it } from 'mocha';

import { UniqueVariableNamesRule } from '../rules/UniqueVariableNamesRule';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrors(UniqueVariableNamesRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

describe('Validate: Unique variable names', () => {
  it('unique variable names', () => {
    expectValid(`
      query A($x: Int, $y: String) { __typename }
      query B($x: String, $y: Int) { __typename }
    `);
  });

  it('duplicate variable names', () => {
    expectErrors(`
      query A($x: Int, $x: Int, $x: String) { __typename }
      query B($x: String, $x: Int) { __typename }
      query C($x: Int, $x: Int) { __typename }
    `).toDeepEqual([
      {
        message: 'There can be only one variable named "$x".',
        locations: [
          { line: 2, column: 16 },
          { line: 2, column: 25 },
          { line: 2, column: 34 },
        ],
      },
      {
        message: 'There can be only one variable named "$x".',
        locations: [
          { line: 3, column: 16 },
          { line: 3, column: 28 },
        ],
      },
      {
        message: 'There can be only one variable named "$x".',
        locations: [
          { line: 4, column: 16 },
          { line: 4, column: 25 },
        ],
      },
    ]);
  });
});
