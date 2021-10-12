import { describe, it } from 'mocha';

import { KnownFragmentNamesRule } from '../rules/KnownFragmentNamesRule';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrors(KnownFragmentNamesRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

describe('Validate: Known fragment names', () => {
  it('known fragment names are valid', () => {
    expectValid(`
      {
        human(id: 4) {
          ...HumanFields1
          ... on Human {
            ...HumanFields2
          }
          ... {
            name
          }
        }
      }
      fragment HumanFields1 on Human {
        name
        ...HumanFields3
      }
      fragment HumanFields2 on Human {
        name
      }
      fragment HumanFields3 on Human {
        name
      }
    `);
  });

  it('unknown fragment names are invalid', () => {
    expectErrors(`
      {
        human(id: 4) {
          ...UnknownFragment1
          ... on Human {
            ...UnknownFragment2
          }
        }
      }
      fragment HumanFields on Human {
        name
        ...UnknownFragment3
      }
    `).toDeepEqual([
      {
        message: 'Unknown fragment "UnknownFragment1".',
        locations: [{ line: 4, column: 14 }],
      },
      {
        message: 'Unknown fragment "UnknownFragment2".',
        locations: [{ line: 6, column: 16 }],
      },
      {
        message: 'Unknown fragment "UnknownFragment3".',
        locations: [{ line: 12, column: 12 }],
      },
    ]);
  });
});
