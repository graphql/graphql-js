import { describe, it } from 'node:test';

import { buildSchema } from '../../utilities/buildASTSchema.ts';

import { DeferStreamDirectiveOnValidOperationsRule } from '../rules/DeferStreamDirectiveOnValidOperationsRule.ts';

import { expectValidationErrorsWithSchema } from './harness.ts';

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
  it('Defer fragment spread with @skip directive', () => {
    expectValid(`
      subscription MySubscription {
        subscriptionField {
          ...myFragment @skip @defer
        }
      }
      fragment myFragment on Message {
        body
      }
    `);
  });
  it('Defer fragment spread with @skip(if: true) directive', () => {
    expectValid(`
      subscription MySubscription {
        subscriptionField {
          ...myFragment @skip(if: true) @defer
        }
      }
      fragment myFragment on Message {
        body
      }
    `);
  });
  it('Defer fragment spread with @skip(if: false) directive', () => {
    expectErrors(`
      subscription MySubscription {
        subscriptionField {
          ...myFragment @skip(if: false) @defer
        }
      }
      fragment myFragment on Message {
        body
      }
    `).toDeepEqual([
      {
        locations: [{ column: 42, line: 4 }],
        message:
          'Defer directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
      },
    ]);
  });
  it('Defer in fragment spread nested under @skip(if: true) directive', () => {
    expectValid(`
      subscription MySubscription {
        subscriptionField {
          ...outerFragment @skip(if: true)
        }
      }
      fragment outerFragment on Message {
        ...myFragment @defer
      }
      fragment myFragment on Message {
        body
      }
    `);
  });
  it('Defer in fragment spread nested under @skip(if: false) directive', () => {
    expectErrors(`
      subscription MySubscription {
        subscriptionField {
          ...outerFragment @skip(if: false)
        }
      }
      fragment outerFragment on Message {
        ...myFragment @defer
      }
      fragment myFragment on Message {
        body
      }
    `).toDeepEqual([
      {
        locations: [
          { column: 23, line: 8 },
          { column: 11, line: 4 },
        ],
        message:
          'Defer directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
      },
    ]);
  });
  it('Defer in fragment spread nested under @skip(if: $variable) directive', () => {
    expectValid(`
      subscription MySubscription($variable: Boolean) {
        subscriptionField {
          ...outerFragment @skip(if: $variable)
        }
      }
      fragment outerFragment on Message {
        ...myFragment @defer
      }
      fragment myFragment on Message {
        body
      }
    `);
  });
  it('Defer fragment spread with @skip(if: $variable) directive', () => {
    expectValid(`
      subscription MySubscription($variable: Boolean) {
        subscriptionField {
          ...myFragment @skip(if: $variable) @defer
        }
      }
      fragment myFragment on Message {
        body
      }
    `);
  });
  it('Defer fragment spread with @include directive', () => {
    expectErrors(`
      subscription MySubscription {
        subscriptionField {
          ...myFragment @include @defer
        }
      }
      fragment myFragment on Message {
        body
      }
    `).toDeepEqual([
      {
        locations: [{ column: 34, line: 4 }],
        message:
          'Defer directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
      },
    ]);
  });
  it('Defer fragment spread with @include(if: true) directive', () => {
    expectErrors(`
      subscription MySubscription {
        subscriptionField {
          ...myFragment @include(if: true) @defer
        }
      }
      fragment myFragment on Message {
        body
      }
    `).toDeepEqual([
      {
        locations: [{ column: 44, line: 4 }],
        message:
          'Defer directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
      },
    ]);
  });
  it('Defer fragment spread with @include(if: false) directive', () => {
    expectValid(`
      subscription MySubscription {
        subscriptionField {
          ...myFragment @include(if: false) @defer
        }
      }
      fragment myFragment on Message {
        body
      }
    `);
  });
  it('Defer in fragment spread nested under @include(if: true) directive', () => {
    expectErrors(`
      subscription MySubscription {
        subscriptionField {
          ...outerFragment @include(if: true)
        }
      }
      fragment outerFragment on Message {
        ...myFragment @defer
      }
      fragment myFragment on Message {
        body
      }
    `).toDeepEqual([
      {
        locations: [
          { column: 23, line: 8 },
          { column: 11, line: 4 },
        ],
        message:
          'Defer directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
      },
    ]);
  });
  it('Defer in fragment spread nested under @include(if: false) directive', () => {
    expectValid(`
      subscription MySubscription {
        subscriptionField {
          ...outerFragment @include(if: false)
        }
      }
      fragment outerFragment on Message {
        ...myFragment @defer
      }
      fragment myFragment on Message {
        body
      }
    `);
  });
  it('Defer in fragment spread nested under @include(if: $variable) directive', () => {
    expectValid(`
      subscription MySubscription($variable: Boolean) {
        subscriptionField {
          ...outerFragment @include(if: $variable)
        }
      }
      fragment outerFragment on Message {
        ...myFragment @defer
      }
      fragment myFragment on Message {
        body
      }
    `);
  });
  it('Defer fragment spread with @include(if: $variable) directive', () => {
    expectValid(`
      subscription MySubscription ($variable: Boolean) {
        subscriptionField {
          ...myFragment @include(if: $variable) @defer
        }
      }
      fragment myFragment on Message {
        body
      }
    `);
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
        locations: [
          { line: 8, column: 18 },
          { line: 4, column: 11 },
        ],
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
        locations: [
          { line: 15, column: 18 },
          { line: 10, column: 13 },
        ],
      },
    ]);
  });
  it('Stream on subscription in document with fragment used multiple times', () => {
    expectErrors(`
      subscription MySubscription {
        subscriptionField {
          message {
            ...myOtherFragment
            ...myFragment  # not visited twice
          }
        }
      }
      fragment myOtherFragment on Message {
        ...myFragment
      }
      fragment myFragment on Message {
        messages @stream
      }
    `).toDeepEqual([
      {
        message:
          'Stream directive not supported on subscription operations. Disable `@stream` by setting the `if` argument to `false`.',
        locations: [
          { line: 14, column: 18 },
          { line: 11, column: 9 },
          { line: 5, column: 13 },
        ],
      },
    ]);
  });
});
