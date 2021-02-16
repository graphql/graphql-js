import { describe, it } from 'mocha';

import { StreamDirectiveOnListFieldRule } from '../rules/StreamDirectiveOnListFieldRule';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrors(StreamDirectiveOnListFieldRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).to.deep.equal([]);
}

describe('Validate: Stream directive on list field', () => {
  it('Stream on list field', () => {
    expectValid(`
      fragment objectFieldSelection on Human {
        pets @stream(initialCount: 0) {
          name
        }
      }
    `);
  });

  it("Doesn't validate other directives", () => {
    expectValid(`
      fragment objectFieldSelection on Human {
        pets @include(if: true) {
          name
        }
      }
    `);
  });

  it("Doesn't validate misplaced stream directives", () => {
    expectValid(`
      fragment objectFieldSelection on Human {
        ... @stream(initialCount: 0) {
          name
        }
      }
    `);
  });

  it('reports errors when stream is used on non-list field', () => {
    expectErrors(`
      fragment objectFieldSelection on Human {
        name @stream(initialCount: 0)
      }
    `).to.deep.equal([
      {
        message:
          'Stream directive cannot be used on non-list field "name" on type "Human".',
        locations: [{ line: 3, column: 14 }],
      },
    ]);
  });
});
