import { expect } from 'chai';
import { describe, it } from 'mocha';

import { Kind } from '../../language/kinds';
import { parse } from '../../language/parser';
import { visit } from '../../language/visitor';

import { buildSchema } from '../../utilities/buildASTSchema';

import { SingleFieldSubscriptionsRule } from '../rules/SingleFieldSubscriptionsRule';
import { validate } from '../validate';

import { expectValidationErrorsWithSchema } from './harness';

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
  it('accounts for include and custom subscription directives', () => {
    const document = parse(
      'subscription { importantEmails @include(if: true) @custom }',
    );
    expect(
      validate(schema, document, [SingleFieldSubscriptionsRule]),
    ).to.deep.equal([]);
  });
  it('preserves errors for directive AST nodes without argument arrays', () => {
    const document = visit(parse('subscription { importantEmails @include }'), {
      [Kind.DIRECTIVE](node) {
        return { ...node, arguments: undefined };
      },
    });
    expect(() =>
      validate(schema, document, [SingleFieldSubscriptionsRule]),
    ).to.throw('Argument "if" of required type "Boolean!" was not provided.');
  });
  it('bounds repeated subscription fragment and directive work', () => {
    const operations = Array.from(
      { length: 300 },
      (_, i) => `subscription S${i} { ...F }`,
    ).join('\n');
    const fragment = `fragment F on SubscriptionRoot { ${'importantEmails @skip(if: false) '.repeat(
      100,
    )} }`;
    const errors = validate(schema, parse(operations + fragment), [
      SingleFieldSubscriptionsRule,
    ]);
    expect(errors.map((error) => error.message)).to.deep.equal([
      'Validation aborted.',
    ]);
  });

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
