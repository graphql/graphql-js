import { describe, it } from 'mocha';

import { buildSchema } from '../../utilities/buildASTSchema.js';

import { DeferStreamDirectiveOnRootFieldRule } from '../rules/DeferStreamDirectiveOnRootFieldRule.js';

import { expectValidationErrorsWithSchema } from './harness.js';

function expectErrors(queryStr: string) {
  return expectValidationErrorsWithSchema(
    schema,
    DeferStreamDirectiveOnRootFieldRule,
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

describe('Validate: Defer/Stream directive on root field', () => {
  it('Defer fragment spread on root query field', () => {
    expectValid(`
      {
        ...rootQueryFragment @defer
      }
      fragment rootQueryFragment on QueryRoot {
        message {
          body
        }
      }
    `);
  });

  it('Defer inline fragment spread on root query field', () => {
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

  it('Defer fragment spread on root mutation field', () => {
    expectErrors(`
      mutation {
        ...rootFragment @defer
      }
      fragment rootFragment on MutationRoot {
        mutationField {
          body
        }
      }
    `).toDeepEqual([
      {
        message:
          'Defer directive cannot be used on root mutation type "MutationRoot".',
        locations: [{ line: 3, column: 25 }],
      },
    ]);
  });
  it('Defer inline fragment spread on root mutation field', () => {
    expectErrors(`
      mutation {
        ... @defer {
          mutationField {
            body
          }
        }
      }
    `).toDeepEqual([
      {
        message:
          'Defer directive cannot be used on root mutation type "MutationRoot".',
        locations: [{ line: 3, column: 13 }],
      },
    ]);
  });

  it('Defer fragment spread on nested mutation field', () => {
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

  it('Defer fragment spread on root subscription field', () => {
    expectErrors(`
      subscription {
        ...rootFragment @defer
      }
      fragment rootFragment on SubscriptionRoot {
        subscriptionField {
          body
        }
      }
    `).toDeepEqual([
      {
        message:
          'Defer directive cannot be used on root subscription type "SubscriptionRoot".',
        locations: [{ line: 3, column: 25 }],
      },
    ]);
  });
  it('Defer inline fragment spread on root subscription field', () => {
    expectErrors(`
      subscription {
        ... @defer {
          subscriptionField {
            body
          }
        }
      }
    `).toDeepEqual([
      {
        message:
          'Defer directive cannot be used on root subscription type "SubscriptionRoot".',
        locations: [{ line: 3, column: 13 }],
      },
    ]);
  });

  it('Defer fragment spread on nested subscription field', () => {
    expectValid(`
      subscription {
        subscriptionField {
          ...nestedFragment @defer
        }
      }
      fragment nestedFragment on Message {
        body
      }
    `);
  });
  it('Stream field on root query field', () => {
    expectValid(`
      {
        messages @stream {
          name
        }
      }
    `);
  });
  it('Stream field on fragment on root query field', () => {
    expectValid(`
      {
        ...rootFragment
      }
      fragment rootFragment on QueryType {
        messages @stream {
          name
        }
      }
    `);
  });
  it('Stream field on root mutation field', () => {
    expectErrors(`
      mutation {
        mutationListField @stream {
          name
        }
      }
    `).toDeepEqual([
      {
        message:
          'Stream directive cannot be used on root mutation type "MutationRoot".',
        locations: [{ line: 3, column: 27 }],
      },
    ]);
  });
  it('Stream field on fragment on root mutation field', () => {
    expectErrors(`
      mutation {
        ...rootFragment
      }
      fragment rootFragment on MutationRoot {
        mutationListField @stream {
          name
        }
      }
    `).toDeepEqual([
      {
        message:
          'Stream directive cannot be used on root mutation type "MutationRoot".',
        locations: [{ line: 6, column: 27 }],
      },
    ]);
  });
  it('Stream field on root subscription field', () => {
    expectErrors(`
      subscription {
        subscriptionListField @stream {
          name
        }
      }
    `).toDeepEqual([
      {
        message:
          'Stream directive cannot be used on root subscription type "SubscriptionRoot".',
        locations: [{ line: 3, column: 31 }],
      },
    ]);
  });
  it('Stream field on fragment on root subscription field', () => {
    expectErrors(`
      subscription {
        ...rootFragment
      }
      fragment rootFragment on SubscriptionRoot {
        subscriptionListField @stream {
          name
        }
      }
    `).toDeepEqual([
      {
        message:
          'Stream directive cannot be used on root subscription type "SubscriptionRoot".',
        locations: [{ line: 6, column: 31 }],
      },
    ]);
  });
});
