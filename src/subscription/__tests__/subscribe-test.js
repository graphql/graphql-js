import { expect } from 'chai';
import { describe, it } from 'mocha';

import resolveOnNextTick from '../../__testUtils__/resolveOnNextTick';

import invariant from '../../jsutils/invariant';
import isAsyncIterable from '../../jsutils/isAsyncIterable';

import type { DocumentNode } from '../../language/ast';
import { parse } from '../../language/parser';

import { GraphQLError } from '../../error/GraphQLError';

import { GraphQLSchema } from '../../type/schema';
import { GraphQLList, GraphQLObjectType } from '../../type/definition';
import { GraphQLInt, GraphQLString, GraphQLBoolean } from '../../type/scalars';

import { createSourceEventStream, subscribe } from '../subscribe';

import SimplePubSub from './simplePubSub';

type Email = {|
  from: string,
  subject: string,
  message: string,
  unread: boolean,
|};

const EmailType = new GraphQLObjectType({
  name: 'Email',
  fields: {
    from: { type: GraphQLString },
    subject: { type: GraphQLString },
    message: { type: GraphQLString },
    unread: { type: GraphQLBoolean },
  },
});

const InboxType = new GraphQLObjectType({
  name: 'Inbox',
  fields: {
    total: {
      type: GraphQLInt,
      resolve: (inbox) => inbox.emails.length,
    },
    unread: {
      type: GraphQLInt,
      resolve: (inbox) => inbox.emails.filter((email) => email.unread).length,
    },
    emails: { type: new GraphQLList(EmailType) },
  },
});

const QueryType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    inbox: { type: InboxType },
  },
});

const EmailEventType = new GraphQLObjectType({
  name: 'EmailEvent',
  fields: {
    email: { type: EmailType },
    inbox: { type: InboxType },
  },
});

const emailSchema = emailSchemaWithResolvers();

function emailSchemaWithResolvers<T: mixed>(
  subscribeFn?: (T) => mixed,
  resolveFn?: (T) => mixed,
) {
  return new GraphQLSchema({
    query: QueryType,
    subscription: new GraphQLObjectType({
      name: 'Subscription',
      fields: {
        importantEmail: {
          type: EmailEventType,
          resolve: resolveFn,
          subscribe: subscribeFn,
          args: {
            priority: { type: GraphQLInt },
          },
        },
      },
    }),
  });
}

const defaultSubscriptionAST = parse(`
  subscription ($priority: Int = 0) {
    importantEmail(priority: $priority) {
      email {
        from
        subject
      }
      inbox {
        unread
        total
      }
    }
  }
`);

function createSubscription(
  pubsub: SimplePubSub<Email>,
  schema: GraphQLSchema = emailSchema,
  document: DocumentNode = defaultSubscriptionAST,
) {
  const emails = [
    {
      from: 'joe@graphql.org',
      subject: 'Hello',
      message: 'Hello World',
      unread: false,
    },
  ];

  const data = {
    inbox: { emails },
    importantEmail: pubsub.getSubscriber((newEmail) => {
      emails.push(newEmail);

      return {
        importantEmail: {
          email: newEmail,
          inbox: data.inbox,
        },
      };
    }),
  };

  return subscribe({ schema, document, rootValue: data });
}

async function expectPromiseToThrow(
  promise: () => Promise<mixed>,
  message: string,
) {
  try {
    await promise();
    // istanbul ignore next (Shouldn't be reached)
    expect.fail('promise should have thrown but did not');
  } catch (error) {
    expect(error).to.be.an.instanceOf(Error);
    expect(error.message).to.equal(message);
  }
}

// Check all error cases when initializing the subscription.
describe('Subscription Initialization Phase', () => {
  it('accepts positional arguments', async () => {
    const document = parse(`
      subscription {
        importantEmail
      }
    `);

    async function* emptyAsyncIterator() {
      // Empty
    }

    // $FlowFixMe[incompatible-call]
    const ai = await subscribe(emailSchema, document, {
      importantEmail: emptyAsyncIterator,
    });

    ai.next();
    ai.return();
  });

  it('accepts multiple subscription fields defined in schema', async () => {
    const pubsub = new SimplePubSub();
    const SubscriptionTypeMultiple = new GraphQLObjectType({
      name: 'Subscription',
      fields: {
        importantEmail: { type: EmailEventType },
        nonImportantEmail: { type: EmailEventType },
      },
    });

    const testSchema = new GraphQLSchema({
      query: QueryType,
      subscription: SubscriptionTypeMultiple,
    });

    const subscription = await createSubscription(pubsub, testSchema);
    invariant(isAsyncIterable(subscription));

    pubsub.emit({
      from: 'yuzhi@graphql.org',
      subject: 'Alright',
      message: 'Tests are good',
      unread: true,
    });

    await subscription.next();
  });

  it('accepts type definition with sync subscribe function', async () => {
    const pubsub = new SimplePubSub();
    const schema = new GraphQLSchema({
      query: QueryType,
      subscription: new GraphQLObjectType({
        name: 'Subscription',
        fields: {
          importantEmail: {
            type: GraphQLString,
            subscribe: () => pubsub.getSubscriber(),
          },
        },
      }),
    });

    const subscription = await subscribe({
      schema,
      document: parse(`
        subscription {
          importantEmail
        }
      `),
    });
    invariant(isAsyncIterable(subscription));

    pubsub.emit({ importantEmail: {} });

    await subscription.next();
  });

  it('accepts type definition with async subscribe function', async () => {
    const pubsub = new SimplePubSub();
    const schema = new GraphQLSchema({
      query: QueryType,
      subscription: new GraphQLObjectType({
        name: 'Subscription',
        fields: {
          importantEmail: {
            type: GraphQLString,
            subscribe: async () => {
              await resolveOnNextTick();
              return pubsub.getSubscriber();
            },
          },
        },
      }),
    });

    const subscription = await subscribe({
      schema,
      document: parse(`
        subscription {
          importantEmail
        }
      `),
    });
    invariant(isAsyncIterable(subscription));

    expect(subscription).to.have.property('next');

    pubsub.emit({ importantEmail: {} });
    await subscription.next();
  });

  it('should only resolve the first field of invalid multi-field', async () => {
    let didResolveImportantEmail = false;
    let didResolveNonImportantEmail = false;

    const SubscriptionTypeMultiple = new GraphQLObjectType({
      name: 'Subscription',
      fields: {
        importantEmail: {
          type: EmailEventType,
          subscribe() {
            didResolveImportantEmail = true;
            return new SimplePubSub().getSubscriber();
          },
        },
        nonImportantEmail: {
          type: EmailEventType,
          // istanbul ignore next (Shouldn't be called)
          subscribe() {
            didResolveNonImportantEmail = true;
            return new SimplePubSub().getSubscriber();
          },
        },
      },
    });

    const schema = new GraphQLSchema({
      query: QueryType,
      subscription: SubscriptionTypeMultiple,
    });

    const subscription = await subscribe({
      schema,
      document: parse(`
        subscription {
          importantEmail
          nonImportantEmail
        }
      `),
    });
    invariant(isAsyncIterable(subscription));

    subscription.next(); // Ask for a result, but ignore it.

    expect(didResolveImportantEmail).to.equal(true);
    expect(didResolveNonImportantEmail).to.equal(false);

    // Close subscription
    subscription.return();
  });

  it('throws an error if schema is missing', async () => {
    const document = parse(`
      subscription {
        importantEmail
      }
    `);

    await expectPromiseToThrow(
      // $FlowExpectedError[incompatible-call]
      () => subscribe({ schema: null, document }),
      'Expected null to be a GraphQL schema.',
    );

    await expectPromiseToThrow(
      // $FlowExpectedError[incompatible-call]
      () => subscribe({ document }),
      'Expected undefined to be a GraphQL schema.',
    );
  });

  it('throws an error if document is missing', async () => {
    await expectPromiseToThrow(
      // $FlowExpectedError[incompatible-call]
      () => subscribe({ schema: emailSchema, document: null }),
      'Must provide document.',
    );

    await expectPromiseToThrow(
      // $FlowExpectedError[incompatible-call]
      () => subscribe({ schema: emailSchema }),
      'Must provide document.',
    );
  });

  it('resolves to an error for unknown subscription field', async () => {
    const ast = parse(`
      subscription {
        unknownField
      }
    `);

    const pubsub = new SimplePubSub();
    const subscription = await createSubscription(pubsub, emailSchema, ast);

    expect(subscription).to.deep.equal({
      errors: [
        {
          message: 'The subscription field "unknownField" is not defined.',
          locations: [{ line: 3, column: 9 }],
        },
      ],
    });
  });

  it('should pass through unexpected errors thrown in subscribe', async () => {
    let expectedError;
    try {
      // $FlowExpectedError[incompatible-call]
      await subscribe({ schema: emailSchema, document: {} });
    } catch (error) {
      expectedError = error;
    }
    expect(expectedError).to.be.instanceOf(Error);
  });

  it('throws an error if subscribe does not return an iterator', async () => {
    const invalidEmailSchema = new GraphQLSchema({
      query: QueryType,
      subscription: new GraphQLObjectType({
        name: 'Subscription',
        fields: {
          importantEmail: {
            type: GraphQLString,
            subscribe: () => 'test',
          },
        },
      }),
    });

    const pubsub = new SimplePubSub();

    await expectPromiseToThrow(
      () => createSubscription(pubsub, invalidEmailSchema),
      'Subscription field must return Async Iterable. Received: "test".',
    );
  });

  it('resolves to an error for subscription resolver errors', async () => {
    // Returning an error
    const subscriptionReturningErrorSchema = emailSchemaWithResolvers(
      () => new Error('test error'),
    );
    await testReportsError(subscriptionReturningErrorSchema);

    // Throwing an error
    const subscriptionThrowingErrorSchema = emailSchemaWithResolvers(() => {
      throw new Error('test error');
    });
    await testReportsError(subscriptionThrowingErrorSchema);

    // Resolving to an error
    const subscriptionResolvingErrorSchema = emailSchemaWithResolvers(() =>
      Promise.resolve(new Error('test error')),
    );
    await testReportsError(subscriptionResolvingErrorSchema);

    // Rejecting with an error
    const subscriptionRejectingErrorSchema = emailSchemaWithResolvers(() =>
      Promise.reject(new Error('test error')),
    );
    await testReportsError(subscriptionRejectingErrorSchema);

    async function testReportsError(schema: GraphQLSchema) {
      // Promise<AsyncIterable<ExecutionResult> | ExecutionResult>
      const result = await subscribe({
        schema,
        document: parse(`
          subscription {
            importantEmail
          }
        `),
      });

      expect(result).to.deep.equal({
        errors: [
          {
            message: 'test error',
            locations: [{ line: 3, column: 13 }],
            path: ['importantEmail'],
          },
        ],
      });
    }
  });

  it('resolves to an error for source event stream resolver errors', async () => {
    // Returning an error
    const subscriptionReturningErrorSchema = emailSchemaWithResolvers(
      () => new Error('test error'),
    );
    await testReportsError(subscriptionReturningErrorSchema);

    // Throwing an error
    const subscriptionThrowingErrorSchema = emailSchemaWithResolvers(() => {
      throw new Error('test error');
    });
    await testReportsError(subscriptionThrowingErrorSchema);

    // Resolving to an error
    const subscriptionResolvingErrorSchema = emailSchemaWithResolvers(() =>
      Promise.resolve(new Error('test error')),
    );
    await testReportsError(subscriptionResolvingErrorSchema);

    // Rejecting with an error
    const subscriptionRejectingErrorSchema = emailSchemaWithResolvers(() =>
      Promise.reject(new Error('test error')),
    );
    await testReportsError(subscriptionRejectingErrorSchema);

    async function testReportsError(schema: GraphQLSchema) {
      // Promise<AsyncIterable<ExecutionResult> | ExecutionResult>
      const result = await createSourceEventStream(
        schema,
        parse(`
          subscription {
            importantEmail
          }
        `),
      );

      expect(result).to.deep.equal({
        errors: [
          {
            message: 'test error',
            locations: [{ line: 3, column: 13 }],
            path: ['importantEmail'],
          },
        ],
      });
    }
  });

  it('resolves to an error if variables were wrong type', async () => {
    // If we receive variables that cannot be coerced correctly, subscribe()
    // will resolve to an ExecutionResult that contains an informative error
    // description.
    const ast = parse(`
      subscription ($priority: Int) {
        importantEmail(priority: $priority) {
          email {
            from
            subject
          }
          inbox {
            unread
            total
          }
        }
      }
    `);

    const result = await subscribe({
      schema: emailSchema,
      document: ast,
      variableValues: { priority: 'meow' },
    });

    expect(result).to.deep.equal({
      errors: [
        {
          message:
            'Variable "$priority" got invalid value "meow"; Int cannot represent non-integer value: "meow"',
          locations: [{ line: 2, column: 21 }],
        },
      ],
    });
  });
});

// Once a subscription returns a valid AsyncIterator, it can still yield errors.
describe('Subscription Publish Phase', () => {
  it('produces a payload for multiple subscribe in same subscription', async () => {
    const pubsub = new SimplePubSub();

    const subscription = await createSubscription(pubsub);
    invariant(isAsyncIterable(subscription));

    const secondSubscription = await createSubscription(pubsub);
    invariant(isAsyncIterable(secondSubscription));

    const payload1 = subscription.next();
    const payload2 = secondSubscription.next();

    expect(
      pubsub.emit({
        from: 'yuzhi@graphql.org',
        subject: 'Alright',
        message: 'Tests are good',
        unread: true,
      }),
    ).to.equal(true);

    const expectedPayload = {
      done: false,
      value: {
        data: {
          importantEmail: {
            email: {
              from: 'yuzhi@graphql.org',
              subject: 'Alright',
            },
            inbox: {
              unread: 1,
              total: 2,
            },
          },
        },
      },
    };

    expect(await payload1).to.deep.equal(expectedPayload);
    expect(await payload2).to.deep.equal(expectedPayload);
  });

  it('produces a payload per subscription event', async () => {
    const pubsub = new SimplePubSub();
    const subscription = await createSubscription(pubsub);
    invariant(isAsyncIterable(subscription));

    // Wait for the next subscription payload.
    const payload = subscription.next();

    // A new email arrives!
    expect(
      pubsub.emit({
        from: 'yuzhi@graphql.org',
        subject: 'Alright',
        message: 'Tests are good',
        unread: true,
      }),
    ).to.equal(true);

    // The previously waited on payload now has a value.
    expect(await payload).to.deep.equal({
      done: false,
      value: {
        data: {
          importantEmail: {
            email: {
              from: 'yuzhi@graphql.org',
              subject: 'Alright',
            },
            inbox: {
              unread: 1,
              total: 2,
            },
          },
        },
      },
    });

    // Another new email arrives, before subscription.next() is called.
    expect(
      pubsub.emit({
        from: 'hyo@graphql.org',
        subject: 'Tools',
        message: 'I <3 making things',
        unread: true,
      }),
    ).to.equal(true);

    // The next waited on payload will have a value.
    expect(await subscription.next()).to.deep.equal({
      done: false,
      value: {
        data: {
          importantEmail: {
            email: {
              from: 'hyo@graphql.org',
              subject: 'Tools',
            },
            inbox: {
              unread: 2,
              total: 3,
            },
          },
        },
      },
    });

    // The client decides to disconnect.
    expect(await subscription.return()).to.deep.equal({
      done: true,
      value: undefined,
    });

    // Which may result in disconnecting upstream services as well.
    expect(
      pubsub.emit({
        from: 'adam@graphql.org',
        subject: 'Important',
        message: 'Read me please',
        unread: true,
      }),
    ).to.equal(false); // No more listeners.

    // Awaiting a subscription after closing it results in completed results.
    expect(await subscription.next()).to.deep.equal({
      done: true,
      value: undefined,
    });
  });

  it('produces additional payloads for subscriptions with @defer', async () => {
    const pubsub = new SimplePubSub();
    const subscription = await createSubscription(
      pubsub,
      emailSchema,
      parse(`
        subscription ($priority: Int = 0) {
          importantEmail(priority: $priority) {
            email {
              from
              subject
            }
            ... @defer {
              inbox {
                unread
                total
              }
            }
          }
        }
      `),
    );
    invariant(isAsyncIterable(subscription));
    // Wait for the next subscription payload.
    const payload = subscription.next();

    // A new email arrives!
    expect(
      pubsub.emit({
        from: 'yuzhi@graphql.org',
        subject: 'Alright',
        message: 'Tests are good',
        unread: true,
      }),
    ).to.equal(true);

    // The previously waited on payload now has a value.
    expect(await payload).to.deep.equal({
      done: false,
      value: {
        data: {
          importantEmail: {
            email: {
              from: 'yuzhi@graphql.org',
              subject: 'Alright',
            },
          },
        },
        hasNext: true,
      },
    });

    // Wait for the next payload from @defer
    expect(await subscription.next()).to.deep.equal({
      done: false,
      value: {
        data: {
          inbox: {
            unread: 1,
            total: 2,
          },
        },
        path: ['importantEmail'],
        hasNext: false,
      },
    });

    // Another new email arrives, after all incrementally delivered payloads are received.
    expect(
      pubsub.emit({
        from: 'hyo@graphql.org',
        subject: 'Tools',
        message: 'I <3 making things',
        unread: true,
      }),
    ).to.equal(true);

    // The next waited on payload will have a value.
    expect(await subscription.next()).to.deep.equal({
      done: false,
      value: {
        data: {
          importantEmail: {
            email: {
              from: 'hyo@graphql.org',
              subject: 'Tools',
            },
          },
        },
        hasNext: true,
      },
    });

    // Another new email arrives, before the incrementally delivered payloads from the last email was received.
    expect(
      pubsub.emit({
        from: 'adam@graphql.org',
        subject: 'Important',
        message: 'Read me please',
        unread: true,
      }),
    ).to.equal(true);

    // Deferred payload from previous event is received.
    expect(await subscription.next()).to.deep.equal({
      done: false,
      value: {
        data: {
          inbox: {
            unread: 2,
            total: 3,
          },
        },
        path: ['importantEmail'],
        hasNext: false,
      },
    });

    // Next payload from last event
    expect(await subscription.next()).to.deep.equal({
      done: false,
      value: {
        data: {
          importantEmail: {
            email: {
              from: 'adam@graphql.org',
              subject: 'Important',
            },
          },
        },
        hasNext: true,
      },
    });

    // The client disconnects before the deferred payload is consumed.
    expect(await subscription.return()).to.deep.equal({
      done: true,
      value: undefined,
    });

    // Awaiting a subscription after closing it results in completed results.
    expect(await subscription.next()).to.deep.equal({
      done: true,
      value: undefined,
    });
  });

  it('produces a payload when there are multiple events', async () => {
    const pubsub = new SimplePubSub();
    const subscription = await createSubscription(pubsub);
    invariant(isAsyncIterable(subscription));

    let payload = subscription.next();

    // A new email arrives!
    expect(
      pubsub.emit({
        from: 'yuzhi@graphql.org',
        subject: 'Alright',
        message: 'Tests are good',
        unread: true,
      }),
    ).to.equal(true);

    expect(await payload).to.deep.equal({
      done: false,
      value: {
        data: {
          importantEmail: {
            email: {
              from: 'yuzhi@graphql.org',
              subject: 'Alright',
            },
            inbox: {
              unread: 1,
              total: 2,
            },
          },
        },
      },
    });

    payload = subscription.next();

    // A new email arrives!
    expect(
      pubsub.emit({
        from: 'yuzhi@graphql.org',
        subject: 'Alright 2',
        message: 'Tests are good 2',
        unread: true,
      }),
    ).to.equal(true);

    expect(await payload).to.deep.equal({
      done: false,
      value: {
        data: {
          importantEmail: {
            email: {
              from: 'yuzhi@graphql.org',
              subject: 'Alright 2',
            },
            inbox: {
              unread: 2,
              total: 3,
            },
          },
        },
      },
    });
  });

  it('should not trigger when subscription is already done', async () => {
    const pubsub = new SimplePubSub();
    const subscription = await createSubscription(pubsub);
    invariant(isAsyncIterable(subscription));

    let payload = subscription.next();

    // A new email arrives!
    expect(
      pubsub.emit({
        from: 'yuzhi@graphql.org',
        subject: 'Alright',
        message: 'Tests are good',
        unread: true,
      }),
    ).to.equal(true);

    expect(await payload).to.deep.equal({
      done: false,
      value: {
        data: {
          importantEmail: {
            email: {
              from: 'yuzhi@graphql.org',
              subject: 'Alright',
            },
            inbox: {
              unread: 1,
              total: 2,
            },
          },
        },
      },
    });

    payload = subscription.next();
    subscription.return();

    // A new email arrives!
    expect(
      pubsub.emit({
        from: 'yuzhi@graphql.org',
        subject: 'Alright 2',
        message: 'Tests are good 2',
        unread: true,
      }),
    ).to.equal(false);

    expect(await payload).to.deep.equal({
      done: true,
      value: undefined,
    });
  });

  it('should not trigger when subscription is thrown', async () => {
    const pubsub = new SimplePubSub();
    const subscription = await createSubscription(pubsub);
    invariant(isAsyncIterable(subscription));

    let payload = subscription.next();

    // A new email arrives!
    expect(
      pubsub.emit({
        from: 'yuzhi@graphql.org',
        subject: 'Alright',
        message: 'Tests are good',
        unread: true,
      }),
    ).to.equal(true);

    expect(await payload).to.deep.equal({
      done: false,
      value: {
        data: {
          importantEmail: {
            email: {
              from: 'yuzhi@graphql.org',
              subject: 'Alright',
            },
            inbox: {
              unread: 1,
              total: 2,
            },
          },
        },
      },
    });

    payload = subscription.next();

    // Throw error
    let caughtError;
    try {
      await subscription.throw('ouch');
    } catch (e) {
      caughtError = e;
    }
    expect(caughtError).to.equal('ouch');

    // A new email arrives!
    expect(
      pubsub.emit({
        from: 'yuzhi@graphql.org',
        subject: 'Alright 2',
        message: 'Tests are good 2',
        unread: true,
      }),
    ).to.equal(false);

    expect(await payload).to.deep.equal({
      done: true,
      value: undefined,
    });
  });

  it('event order is correct for multiple publishes', async () => {
    const pubsub = new SimplePubSub();
    const subscription = await createSubscription(pubsub);
    invariant(isAsyncIterable(subscription));

    let payload = subscription.next();

    // A new email arrives!
    expect(
      pubsub.emit({
        from: 'yuzhi@graphql.org',
        subject: 'Message',
        message: 'Tests are good',
        unread: true,
      }),
    ).to.equal(true);

    // A new email arrives!
    expect(
      pubsub.emit({
        from: 'yuzhi@graphql.org',
        subject: 'Message 2',
        message: 'Tests are good 2',
        unread: true,
      }),
    ).to.equal(true);

    expect(await payload).to.deep.equal({
      done: false,
      value: {
        data: {
          importantEmail: {
            email: {
              from: 'yuzhi@graphql.org',
              subject: 'Message',
            },
            inbox: {
              unread: 2,
              total: 3,
            },
          },
        },
      },
    });

    payload = subscription.next();

    expect(await payload).to.deep.equal({
      done: false,
      value: {
        data: {
          importantEmail: {
            email: {
              from: 'yuzhi@graphql.org',
              subject: 'Message 2',
            },
            inbox: {
              unread: 2,
              total: 3,
            },
          },
        },
      },
    });
  });

  it('should handle error during execution of source event', async () => {
    const erroringEmailSchema = emailSchemaWithResolvers(
      async function* () {
        yield { email: { subject: 'Hello' } };
        yield { email: { subject: 'Goodbye' } };
        yield { email: { subject: 'Bonjour' } };
      },
      (event) => {
        if (event.email.subject === 'Goodbye') {
          throw new Error('Never leave.');
        }
        return event;
      },
    );

    const subscription = await subscribe({
      schema: erroringEmailSchema,
      document: parse(`
        subscription {
          importantEmail {
            email {
              subject
            }
          }
        }
      `),
    });
    invariant(isAsyncIterable(subscription));

    const payload1 = await subscription.next();
    expect(payload1).to.deep.equal({
      done: false,
      value: {
        data: {
          importantEmail: {
            email: {
              subject: 'Hello',
            },
          },
        },
      },
    });

    // An error in execution is presented as such.
    const payload2 = await subscription.next();
    expect(payload2).to.deep.equal({
      done: false,
      value: {
        errors: [
          {
            message: 'Never leave.',
            locations: [{ line: 3, column: 11 }],
            path: ['importantEmail'],
          },
        ],
        data: {
          importantEmail: null,
        },
      },
    });

    // However that does not close the response event stream. Subsequent
    // events are still executed.
    const payload3 = await subscription.next();
    expect(payload3).to.deep.equal({
      done: false,
      value: {
        data: {
          importantEmail: {
            email: {
              subject: 'Bonjour',
            },
          },
        },
      },
    });
  });

  it('should pass through error thrown in source event stream', async () => {
    const erroringEmailSchema = emailSchemaWithResolvers(
      async function* () {
        yield { email: { subject: 'Hello' } };
        throw new Error('test error');
      },
      (email) => email,
    );

    const subscription = await subscribe({
      schema: erroringEmailSchema,
      document: parse(`
        subscription {
          importantEmail {
            email {
              subject
            }
          }
        }
      `),
    });
    invariant(isAsyncIterable(subscription));

    const payload1 = await subscription.next();
    expect(payload1).to.deep.equal({
      done: false,
      value: {
        data: {
          importantEmail: {
            email: {
              subject: 'Hello',
            },
          },
        },
      },
    });

    let expectedError;
    try {
      await subscription.next();
    } catch (error) {
      expectedError = error;
    }

    expect(expectedError).to.be.instanceof(Error);
    expect(expectedError).to.have.property('message', 'test error');

    const payload2 = await subscription.next();
    expect(payload2).to.deep.equal({
      done: true,
      value: undefined,
    });
  });

  it('should resolve GraphQL error from source event stream', async () => {
    const erroringEmailSchema = emailSchemaWithResolvers(
      async function* () {
        yield { email: { subject: 'Hello' } };
        throw new GraphQLError('test error');
      },
      (email) => email,
    );

    const subscription = await subscribe({
      schema: erroringEmailSchema,
      document: parse(`
        subscription {
          importantEmail {
            email {
              subject
            }
          }
        }
      `),
    });
    invariant(isAsyncIterable(subscription));

    const payload1 = await subscription.next();
    expect(payload1).to.deep.equal({
      done: false,
      value: {
        data: {
          importantEmail: {
            email: {
              subject: 'Hello',
            },
          },
        },
      },
    });

    const payload2 = await subscription.next();
    expect(payload2).to.deep.equal({
      done: false,
      value: {
        errors: [
          {
            message: 'test error',
          },
        ],
      },
    });

    const payload3 = await subscription.next();
    expect(payload3).to.deep.equal({
      done: true,
      value: undefined,
    });
  });
});
