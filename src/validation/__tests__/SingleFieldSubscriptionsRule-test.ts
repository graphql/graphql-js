import { describe, it } from 'mocha';

import { buildSchema } from '../../utilities/buildASTSchema.js';

import { SingleFieldSubscriptionsRule } from '../rules/SingleFieldSubscriptionsRule.js';

import { expectValidationErrorsWithSchema } from './harness.js';

function expectErrors(queryStr: string) {
  return expectValidationErrorsWithSchema(
    schema,
    SingleFieldSubscriptionsRule,
    queryStr,
  );
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

const schema = buildSchema(`
  type Message {
    body: String
    sender: String
  }

  type SubscriptionRoot {
    importantEmails: [String]
    notImportantEmails: [String]
    moreImportantEmails: [String]
    spamEmails: [String]
    deletedEmails: [String]
    newMessage: Message
  }

  type QueryRoot {
    dummy: String
  }

  schema {
    query: QueryRoot
    subscription: SubscriptionRoot
  }
`);

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

      fragment newMessageFields on SubscriptionRoot {
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

      fragment newMessageFields on SubscriptionRoot {
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
    `).toDeepEqual([
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
    `).toDeepEqual([
      {
        message:
          'Subscription "ImportantEmails" must select only one top level field.',
        locations: [{ line: 4, column: 9 }],
      },
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
      fragment Introspection on SubscriptionRoot {
        typename: __typename
      }
    `).toDeepEqual([
      {
        message:
          'Subscription "ImportantEmails" must select only one top level field.',
        locations: [{ line: 7, column: 9 }],
      },
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
    `).toDeepEqual([
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
      fragment NotImportantEmails on SubscriptionRoot {
        notImportantEmails
        deleted: deletedEmails
        ...SpamEmails
      }
      fragment SpamEmails on SubscriptionRoot {
        spamEmails
      }
    `).toDeepEqual([
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
      fragment A on SubscriptionRoot {
        ...A
      }
    `).toDeepEqual([]);
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
      fragment NotImportantEmails on SubscriptionRoot {
        notImportantEmails
        deleted: deletedEmails
        ... {
          ... {
            archivedEmails
          }
        }
        ...SpamEmails
      }
      fragment SpamEmails on SubscriptionRoot {
        spamEmails
        ...NonExistentFragment
      }
    `).toDeepEqual([
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
    `).toDeepEqual([
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
    `).toDeepEqual([
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
    `).toDeepEqual([
      {
        message:
          'Anonymous Subscription must not select an introspection top level field.',
        locations: [{ line: 3, column: 9 }],
      },
    ]);
  });

  it('fails with @skip or @include directive', () => {
    expectErrors(`
      subscription RequiredRuntimeValidation($bool: Boolean!) {
        newMessage @include(if: $bool) {
          body
          sender
        }
        disallowedSecondRootField @skip(if: $bool)
      }
    `).toDeepEqual([
      {
        message:
          'Subscription "RequiredRuntimeValidation" must not use `@skip` or `@include` directives in the top level selection.',
        locations: [
          { line: 3, column: 20 },
          { line: 7, column: 35 },
        ],
      },
    ]);
  });

  it('fails with @skip or @include directive in anonymous subscription', () => {
    expectErrors(`
      subscription ($bool: Boolean!) {
        newMessage @include(if: $bool) {
          body
          sender
        }
        disallowedSecondRootField @skip(if: $bool)
      }
    `).toDeepEqual([
      {
        message:
          'Anonymous Subscription must not use `@skip` or `@include` directives in the top level selection.',
        locations: [
          { line: 3, column: 20 },
          { line: 7, column: 35 },
        ],
      },
    ]);
  });

  it('skips if not subscription type', () => {
    const emptySchema = buildSchema(`
      type Query {
        dummy: String
      }
    `);

    expectValidationErrorsWithSchema(
      emptySchema,
      SingleFieldSubscriptionsRule,
      `
        subscription {
          __typename
        }
      `,
    ).toDeepEqual([]);
  });
});
