import { describe, it } from 'mocha';

import { StreamDirectiveOnListFieldRule } from '../rules/StreamDirectiveOnListFieldRule';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrors(StreamDirectiveOnListFieldRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
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

  it('Stream on non-null list field', () => {
    expectValid(`
      fragment objectFieldSelection on Human {
        relatives @stream(initialCount: 0) {
          name
        }
      }
    `);
  });

  it("Doesn't validate other directives on list fields", () => {
    expectValid(`
    fragment objectFieldSelection on Human {
      pets @include(if: true) {
        name
      }
    }
    `);
  });

  it("Doesn't validate other directives on non-list fields", () => {
    expectValid(`
      fragment objectFieldSelection on Human {
        pets {
          name @include(if: true)
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
    `).toDeepEqual([
      {
        message:
          'Stream directive cannot be used on non-list field "name" on type "Human".',
        locations: [{ line: 3, column: 14 }],
      },
    ]);
  });
});
