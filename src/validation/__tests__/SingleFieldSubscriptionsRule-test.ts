import { describe, it } from 'mocha';

import { SingleFieldSubscriptionsRule } from '../rules/SingleFieldSubscriptionsRule';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrors(SingleFieldSubscriptionsRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).to.deep.equal([]);
}

describe('Validate: Subscriptions with single field', () => {
  it('valid subscription', () => {
    expectValid(`
      subscription ImportantEmails {
        importantEmails
      }
    `);
  });

  it('valid subscription with fragment', () => {
    // From https://spec.graphql.org/draft/#example-13061
    expectValid(`
      subscription sub {
        ...newMessageFields
      }

      fragment newMessageFields on Subscription {
        newMessage {
          body
          sender
        }
      }
    `);
  });

  it('valid subscription with fragment and field', () => {
    // From https://spec.graphql.org/draft/#example-13061
    expectValid(`
      subscription sub {
        newMessage {
          body
        }
        ...newMessageFields
      }

      fragment newMessageFields on Subscription {
        newMessage {
          body
          sender
        }
      }
    `);
  });

  it('fails with more than one root field', () => {
    expectErrors(`
      subscription ImportantEmails {
        importantEmails
        notImportantEmails
      }
    `).to.deep.equal([
      {
        message:
          'Subscription "ImportantEmails" must select only one top level field.',
        locations: [{ line: 4, column: 9 }],
      },
    ]);
  });

  it('fails with more than one root field including introspection', () => {
    expectErrors(`
      subscription ImportantEmails {
        importantEmails
        __typename
      }
    `).to.deep.equal([
      {
        message:
          'Subscription "ImportantEmails" must not select an introspection top level field.',
        locations: [{ line: 4, column: 9 }],
      },
    ]);
  });

  it('fails with more than one root field including aliased introspection via fragment', () => {
    expectErrors(`
      subscription ImportantEmails {
        importantEmails
        ...Introspection
      }
      fragment Introspection on Subscription {
        typename: __typename
      }
    `).to.deep.equal([
      {
        message:
          'Subscription "ImportantEmails" must not select an introspection top level field.',
        locations: [{ line: 7, column: 9 }],
      },
    ]);
  });

  it('fails with many more than one root field', () => {
    expectErrors(`
      subscription ImportantEmails {
        importantEmails
        notImportantEmails
        spamEmails
      }
    `).to.deep.equal([
      {
        message:
          'Subscription "ImportantEmails" must select only one top level field.',
        locations: [
          { line: 4, column: 9 },
          { line: 5, column: 9 },
        ],
      },
    ]);
  });

  it('fails with many more than one root field via fragments', () => {
    expectErrors(`
      subscription ImportantEmails {
        importantEmails
        ... {
          more: moreImportantEmails
        }
        ...NotImportantEmails
      }
      fragment NotImportantEmails on Subscription {
        notImportantEmails
        deleted: deletedEmails
        ...SpamEmails
      }
      fragment SpamEmails on Subscription {
        spamEmails
      }
    `).to.deep.equal([
      {
        message:
          'Subscription "ImportantEmails" must select only one top level field.',
        locations: [
          { line: 5, column: 11 },
          { line: 10, column: 9 },
          { line: 11, column: 9 },
          { line: 15, column: 9 },
        ],
      },
    ]);
  });

  it('does not infinite loop on recursive fragments', () => {
    expectErrors(`
      subscription NoInfiniteLoop {
        ...A
      }
      fragment A on Subscription {
        ...A
      }
    `).to.deep.equal([]);
  });

  it('fails with many more than one root field via fragments (anonymous)', () => {
    expectErrors(`
      subscription {
        importantEmails
        ... {
          more: moreImportantEmails
          ...NotImportantEmails
        }
        ...NotImportantEmails
      }
      fragment NotImportantEmails on Subscription {
        notImportantEmails
        deleted: deletedEmails
        ... {
          ... {
            archivedEmails
          }
        }
        ...SpamEmails
      }
      fragment SpamEmails on Subscription {
        spamEmails
        ...NonExistentFragment
      }
    `).to.deep.equal([
      {
        message: 'Anonymous Subscription must select only one top level field.',
        locations: [
          { line: 5, column: 11 },
          { line: 11, column: 9 },
          { line: 12, column: 9 },
          { line: 15, column: 13 },
          { line: 21, column: 9 },
        ],
      },
    ]);
  });

  it('fails with more than one root field in anonymous subscriptions', () => {
    expectErrors(`
      subscription {
        importantEmails
        notImportantEmails
      }
    `).to.deep.equal([
      {
        message: 'Anonymous Subscription must select only one top level field.',
        locations: [{ line: 4, column: 9 }],
      },
    ]);
  });

  it('fails with introspection field', () => {
    expectErrors(`
      subscription ImportantEmails {
        __typename
      }
    `).to.deep.equal([
      {
        message:
          'Subscription "ImportantEmails" must not select an introspection top level field.',
        locations: [{ line: 3, column: 9 }],
      },
    ]);
  });

  it('fails with introspection field in anonymous subscription', () => {
    expectErrors(`
      subscription {
        __typename
      }
    `).to.deep.equal([
      {
        message:
          'Anonymous Subscription must not select an introspection top level field.',
        locations: [{ line: 3, column: 9 }],
      },
    ]);
  });
});
