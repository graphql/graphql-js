import { describe, it } from 'mocha';

import { buildSchema } from '../../utilities/buildASTSchema.js';

import { DeferStreamDirectiveOnValidOperationsRule } from '../rules/DeferStreamDirectiveOnValidOperationsRule.js';

import { expectValidationErrorsWithSchema } from './harness.js';

function expectErrors(queryStr: string) {
  return expectValidationErrorsWithSchema(
    schema,
    DeferStreamDirectiveOnValidOperationsRule,
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
    subscriptionField: Message
    subscriptionListField: [Message]
  }

  type MutationRoot {
    mutationField: Message
    mutationListField: [Message]
  }

  type QueryRoot {
    message: Message
    messages: [Message]
  }

  schema {
    query: QueryRoot
    mutation: MutationRoot
    subscription: SubscriptionRoot
  }
`);

describe('Validate: Defer/Stream directive on valid operations', () => {
  it('Defer fragment spread nested in query operation', () => {
    expectValid(`
      {
        message {
          ...myFragment @defer
        }
      }
      fragment myFragment on Message {
        message {
          body
        }
      }
    `);
  });
  it('Defer inline fragment spread in query operation', () => {
    expectValid(`
      {
        ... @defer {
          message {
            body
          }
        }
      }
    `);
  });
  it('Defer fragment spread on mutation field', () => {
    expectValid(`
      mutation {
        mutationField {
          ...myFragment @defer
        }
      }
      fragment myFragment on Message {
        body
      }
    `);
  });
  it('Defer inline fragment spread on mutation field', () => {
    expectValid(`
      mutation {
        mutationField {
          ... @defer {
            body
          }
        }
      }
    `);
  });
  it('Defer fragment spread on subscription field', () => {
    expectErrors(`
      subscription {
        subscriptionField {
          ...myFragment @defer
        }
      }
      fragment myFragment on Message {
        body
      }
    `).toDeepEqual([
      {
        locations: [{ column: 25, line: 4 }],
        message:
          'Defer directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
      },
    ]);
  });
  it('Defer fragment spread with boolean true if argument', () => {
    expectErrors(`
      subscription {
        subscriptionField {
          ...myFragment @defer(if: true)
        }
      }
      fragment myFragment on Message {
        body
      }
    `).toDeepEqual([
      {
        locations: [{ column: 25, line: 4 }],
        message:
          'Defer directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
      },
    ]);
  });
  it('Defer fragment spread with boolean false if argument', () => {
    expectValid(`
      subscription {
        subscriptionField {
          ...myFragment @defer(if: false)
        }
      }
      fragment myFragment on Message {
        body
      }
    `);
  });
  it('Defer fragment spread on query in multi operation document', () => {
    expectValid(`
      subscription MySubscription {
        subscriptionField {
          ...myFragment
        }
      }
      query MyQuery {
        message {
          ...myFragment @defer
        }
      }
      fragment myFragment on Message {
        body
      }
    `);
  });
  it('Defer fragment spread on subscription in multi operation document', () => {
    expectErrors(`
      subscription MySubscription {
        subscriptionField {
          ...myFragment @defer
        }
      }
      query MyQuery {
        message {
          ...myFragment @defer
        }
      }
      fragment myFragment on Message {
        body
      }
    `).toDeepEqual([
      {
        locations: [{ column: 25, line: 4 }],
        message:
          'Defer directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
      },
    ]);
  });
  it('Defer fragment spread with invalid if argument', () => {
    expectErrors(`
      subscription MySubscription {
        subscriptionField {
          ...myFragment @defer(if: "Oops")
        }
      }
      fragment myFragment on Message {
        body
      }
    `).toDeepEqual([
      {
        locations: [{ column: 25, line: 4 }],
        message:
          'Defer directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
      },
    ]);
  });
  it('Stream on query field', () => {
    expectValid(`
      {
        messages @stream {
          name
        }
      }
    `);
  });
  it('Stream on mutation field', () => {
    expectValid(`
      mutation {
        mutationField {
          messages @stream
        }
      }
    `);
  });
  it('Stream on fragment on mutation field', () => {
    expectValid(`
      mutation {
        mutationField {
          ...myFragment
        }
      }
      fragment myFragment on Message {
        messages @stream
      }
    `);
  });
  it('Stream on subscription field', () => {
    expectErrors(`
      subscription {
        subscriptionField {
          messages @stream
        }
      }
    `).toDeepEqual([
      {
        message:
          'Stream directive not supported on subscription operations. Disable `@stream` by setting the `if` argument to `false`.',
        locations: [{ line: 4, column: 20 }],
      },
    ]);
  });
  it('Stream on fragment on subscription field', () => {
    expectErrors(`
      subscription {
        subscriptionField {
          ...myFragment
        }
      }
      fragment myFragment on Message {
        messages @stream
      }
    `).toDeepEqual([
      {
        message:
          'Stream directive not supported on subscription operations. Disable `@stream` by setting the `if` argument to `false`.',
        locations: [{ line: 8, column: 18 }],
      },
    ]);
  });
  it('Stream on fragment on query in multi operation document', () => {
    expectValid(`
      subscription MySubscription {
        subscriptionField {
          message
        }
      }
      query MyQuery {
        message {
          ...myFragment
        }
      }
      fragment myFragment on Message {
        messages @stream
      }
    `);
  });
  it('Stream on subscription in multi operation document', () => {
    expectErrors(`
      query MyQuery {
        message {
          ...myFragment
        }
      }
      subscription MySubscription {
        subscriptionField {
          message {
            ...myFragment
          }
        }
      }
      fragment myFragment on Message {
        messages @stream
      }
    `).toDeepEqual([
      {
        message:
          'Stream directive not supported on subscription operations. Disable `@stream` by setting the `if` argument to `false`.',
        locations: [{ line: 15, column: 18 }],
      },
    ]);
  });
});
