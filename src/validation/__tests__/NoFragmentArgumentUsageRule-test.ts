import { describe, it } from 'mocha';

import { NoFragmentArgumentUsageRule } from '../rules/custom/NoFragmentArgumentUsageRule';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrors(NoFragmentArgumentUsageRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).to.deep.equal([]);
}

describe('Validate: Known fragment names', () => {
  it('known fragment names are valid', () => {
    expectValid(`
      {
        ...HumanFields
      }
      fragment HumanFields on Query {
        human(id: 4) {
          name
        }
      }
    `);
  });

  it('unknown fragment names are invalid', () => {
    expectErrors(`
      {
        ...HumanFields(x: 4)
      }
      fragment HumanFields($x: ID) on Query {
        human(id: $x) {
          name
        }
      }
    `).to.deep.equal([
      {
        message: 'Fragment arguments are not enabled.',
        locations: [{ line: 3, column: 24 }],
      },
      {
        message: 'Fragment argument definitions are not enabled.',
        locations: [{ line: 5, column: 28 }],
      },
    ]);
  });
});
