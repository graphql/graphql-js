import { assert, expect } from 'chai';
import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON';
import { resolveOnNextTick } from '../../__testUtils__/resolveOnNextTick';

import { invariant } from '../../jsutils/invariant';
import { isAsyncIterable } from '../../jsutils/isAsyncIterable';

import { parse } from '../../language/parser';

import { GraphQLList, GraphQLObjectType } from '../../type/definition';
import { GraphQLBoolean, GraphQLInt, GraphQLString } from '../../type/scalars';
import { GraphQLSchema } from '../../type/schema';

import { createSourceEventStream, subscribe } from '../subscribe';

import { SimplePubSub } from './simplePubSub';

interface Email {
  from: string;
  subject: string;
  message: string;
  unread: boolean;
}

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
      resolve: (inbox) =>
        inbox.emails.filter((email: any) => email.unread).length,
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

const emailSchema = new GraphQLSchema({
  query: QueryType,
  subscription: new GraphQLObjectType({
    name: 'Subscription',
    fields: {
      importantEmail: {
        type: EmailEventType,
        args: {
          priority: { type: GraphQLInt },
        },
      },
    },
  }),
});

function createSubscription(pubsub: SimplePubSub<Email>) {
  const document = parse(`
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

  const emails = [
    {
      from: 'joe@graphql.org',
      subject: 'Hello',
      message: 'Hello World',
      unread: false,
    },
  ];

  const data: any = {
    inbox: { emails },
    // FIXME: we shouldn't use mapAsyncIterator here since it makes tests way more complex
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

  return subscribe({ schema: emailSchema, document, rootValue: data });
}

async function expectPromise(promise: Promise<unknown>) {
  let caughtError: Error;

  try {
    /* c8 ignore next 2 */
    await promise;
    expect.fail('promise should have thrown but did not');
  } catch (error) {
    caughtError = error;
  }

  return {
    toReject() {
      expect(caughtError).to.be.an.instanceOf(Error);
    },
    toRejectWith(message: string) {
      expect(caughtError).to.be.an.instanceOf(Error);
      expect(caughtError).to.have.property('message', message);
    },
  };
}

const DummyQueryType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    dummy: { type: GraphQLString },
  },
});

/* eslint-disable @typescript-eslint/require-await */
// Check all error cases when initializing the subscription.
describe('Subscription Initialization Phase', () => {
  it('accepts multiple subscription fields defined in schema', async () => {
    const schema = new GraphQLSchema({
      query: DummyQueryType,
      subscription: new GraphQLObjectType({
        name: 'Subscription',
        fields: {
          foo: { type: GraphQLString },
          bar: { type: GraphQLString },
        },
      }),
    });

    async function* fooGenerator() {
      yield { foo: 'FooValue' };
    }

    const subscription = await subscribe({
      schema,
      document: parse('subscription { foo }'),
      rootValue: { foo: fooGenerator },
    });
    invariant(isAsyncIterable(subscription));

    expect(await subscription.next()).to.deep.equal({
      done: false,
      value: { data: { foo: 'FooValue' } },
    });

    expect(await subscription.next()).to.deep.equal({
      done: true,
      value: undefined,
    });
  });

  it('accepts type definition with sync subscribe function', async () => {
    async function* fooGenerator() {
      yield { foo: 'FooValue' };
    }

    const schema = new GraphQLSchema({
      query: DummyQueryType,
      subscription: new GraphQLObjectType({
        name: 'Subscription',
        fields: {
          foo: {
            type: GraphQLString,
            subscribe: fooGenerator,
          },
        },
      }),
    });

    const subscription = await subscribe({
      schema,
      document: parse('subscription { foo }'),
    });
    invariant(isAsyncIterable(subscription));

    expect(await subscription.next()).to.deep.equal({
      done: false,
      value: { data: { foo: 'FooValue' } },
    });

    expect(await subscription.next()).to.deep.equal({
      done: true,
      value: undefined,
    });
  });

  it('accepts type definition with async subscribe function', async () => {
    async function* fooGenerator() {
      yield { foo: 'FooValue' };
    }

    const schema = new GraphQLSchema({
      query: DummyQueryType,
      subscription: new GraphQLObjectType({
        name: 'Subscription',
        fields: {
          foo: {
            type: GraphQLString,
            async subscribe() {
              await resolveOnNextTick();
              return fooGenerator();
            },
          },
        },
      }),
    });

    const subscription = await subscribe({
      schema,
      document: parse('subscription { foo }'),
    });
    invariant(isAsyncIterable(subscription));

    expect(await subscription.next()).to.deep.equal({
      done: false,
      value: { data: { foo: 'FooValue' } },
    });

    expect(await subscription.next()).to.deep.equal({
      done: true,
      value: undefined,
    });
  });

  it('uses a custom default subscribeFieldResolver', async () => {
    const schema = new GraphQLSchema({
      query: DummyQueryType,
      subscription: new GraphQLObjectType({
        name: 'Subscription',
        fields: {
          foo: { type: GraphQLString },
        },
      }),
    });

    async function* fooGenerator() {
      yield { foo: 'FooValue' };
    }

    const subscription = await subscribe({
      schema,
      document: parse('subscription { foo }'),
      rootValue: { customFoo: fooGenerator },
      subscribeFieldResolver: (root) => root.customFoo(),
    });
    invariant(isAsyncIterable(subscription));

    expect(await subscription.next()).to.deep.equal({
      done: false,
      value: { data: { foo: 'FooValue' } },
    });

    expect(await subscription.next()).to.deep.equal({
      done: true,
      value: undefined,
    });
  });

  it('should only resolve the first field of invalid multi-field', async () => {
    async function* fooGenerator() {
      yield { foo: 'FooValue' };
    }

    let didResolveFoo = false;
    let didResolveBar = false;

    const schema = new GraphQLSchema({
      query: DummyQueryType,
      subscription: new GraphQLObjectType({
        name: 'Subscription',
        fields: {
          foo: {
            type: GraphQLString,
            subscribe() {
              didResolveFoo = true;
              return fooGenerator();
            },
          },
          bar: {
            type: GraphQLString,
            /* c8 ignore next 3 */
            subscribe() {
              didResolveBar = true;
            },
          },
        },
      }),
    });

    const subscription = await subscribe({
      schema,
      document: parse('subscription { foo bar }'),
    });
    invariant(isAsyncIterable(subscription));

    expect(didResolveFoo).to.equal(true);
    expect(didResolveBar).to.equal(false);

    expect(await subscription.next()).to.have.property('done', false);

    expect(await subscription.next()).to.deep.equal({
      done: true,
      value: undefined,
    });
  });

  it('throws an error if some of required arguments are missing', async () => {
    const document = parse('subscription { foo }');
    const schema = new GraphQLSchema({
      query: DummyQueryType,
      subscription: new GraphQLObjectType({
        name: 'Subscription',
        fields: {
          foo: { type: GraphQLString },
        },
      }),
    });

    // @ts-expect-error (schema must not be null)
    (await expectPromise(subscribe({ schema: null, document }))).toRejectWith(
      'Expected null to be a GraphQL schema.',
    );

    // @ts-expect-error
    (await expectPromise(subscribe({ document }))).toRejectWith(
      'Expected undefined to be a GraphQL schema.',
    );

    // @ts-expect-error (document must not be null)
    (await expectPromise(subscribe({ schema, document: null }))).toRejectWith(
      'Must provide document.',
    );

    // @ts-expect-error
    (await expectPromise(subscribe({ schema }))).toRejectWith(
      'Must provide document.',
    );
  });

  it('Deprecated: allows positional arguments to createSourceEventStream', async () => {
    async function* fooGenerator() {
      /* c8 ignore next 2 */
      yield { foo: 'FooValue' };
    }

    const schema = new GraphQLSchema({
      query: DummyQueryType,
      subscription: new GraphQLObjectType({
        name: 'Subscription',
        fields: {
          foo: { type: GraphQLString, subscribe: fooGenerator },
        },
      }),
    });
    const document = parse('subscription { foo }');

    const eventStream = await createSourceEventStream(schema, document);
    assert(isAsyncIterable(eventStream));
  });

  it('Deprecated: throws an error if document is missing when using positional arguments', async () => {
    const document = parse('subscription { foo }');
    const schema = new GraphQLSchema({
      query: DummyQueryType,
      subscription: new GraphQLObjectType({
        name: 'Subscription',
        fields: {
          foo: { type: GraphQLString },
        },
      }),
    });

    // @ts-expect-error (schema must not be null)
    (await expectPromise(createSourceEventStream(null, document))).toRejectWith(
      'Expected null to be a GraphQL schema.',
    );

    (
      await expectPromise(
        createSourceEventStream(
          // @ts-expect-error
          undefined,
          document,
        ),
      )
    ).toRejectWith('Expected undefined to be a GraphQL schema.');

    // @ts-expect-error (document must not be null)
    (await expectPromise(createSourceEventStream(schema, null))).toRejectWith(
      'Must provide document.',
    );

    // @ts-expect-error
    (await expectPromise(createSourceEventStream(schema))).toRejectWith(
      'Must provide document.',
    );
  });

  it('resolves to an error if schema does not support subscriptions', async () => {
    const schema = new GraphQLSchema({ query: DummyQueryType });
    const document = parse('subscription { unknownField }');

    const result = await subscribe({ schema, document });
    expectJSON(result).toDeepEqual({
      errors: [
        {
          message:
            'Schema is not configured to execute subscription operation.',
          locations: [{ line: 1, column: 1 }],
        },
      ],
    });
  });

  it('resolves to an error for unknown subscription field', async () => {
    const schema = new GraphQLSchema({
      query: DummyQueryType,
      subscription: new GraphQLObjectType({
        name: 'Subscription',
        fields: {
          foo: { type: GraphQLString },
        },
      }),
    });
    const document = parse('subscription { unknownField }');

    const result = await subscribe({ schema, document });
    expectJSON(result).toDeepEqual({
      errors: [
        {
          message: 'The subscription field "unknownField" is not defined.',
          locations: [{ line: 1, column: 16 }],
        },
      ],
    });
  });

  it('should pass through unexpected errors thrown in subscribe', async () => {
    const schema = new GraphQLSchema({
      query: DummyQueryType,
      subscription: new GraphQLObjectType({
        name: 'Subscription',
        fields: {
          foo: { type: GraphQLString },
        },
      }),
    });

    // @ts-expect-error
    (await expectPromise(subscribe({ schema, document: {} }))).toReject();
  });

  it('throws an error if subscribe does not return an iterator', async () => {
    const schema = new GraphQLSchema({
      query: DummyQueryType,
      subscription: new GraphQLObjectType({
        name: 'Subscription',
        fields: {
          foo: {
            type: GraphQLString,
            subscribe: () => 'test',
          },
        },
      }),
    });

    const document = parse('subscription { foo }');

    (await expectPromise(subscribe({ schema, document }))).toRejectWith(
      'Subscription field must return Async Iterable. Received: "test".',
    );
  });

  it('resolves to an error for subscription resolver errors', async () => {
    async function subscribeWithFn(subscribeFn: () => unknown) {
      const schema = new GraphQLSchema({
        query: DummyQueryType,
        subscription: new GraphQLObjectType({
          name: 'Subscription',
          fields: {
            foo: { type: GraphQLString, subscribe: subscribeFn },
          },
        }),
      });
      const document = parse('subscription { foo }');
      const result = await subscribe({ schema, document });

      expectJSON(await createSourceEventStream(schema, document)).toDeepEqual(
        result,
      );
      return result;
    }

    const expectedResult = {
      errors: [
        {
          message: 'test error',
          locations: [{ line: 1, column: 16 }],
          path: ['foo'],
        },
      ],
    };

    expectJSON(
      // Returning an error
      await subscribeWithFn(() => new Error('test error')),
    ).toDeepEqual(expectedResult);

    expectJSON(
      // Throwing an error
      await subscribeWithFn(() => {
        throw new Error('test error');
      }),
    ).toDeepEqual(expectedResult);

    expectJSON(
      // Resolving to an error
      await subscribeWithFn(() => Promise.resolve(new Error('test error'))),
    ).toDeepEqual(expectedResult);

    expectJSON(
      // Rejecting with an error
      await subscribeWithFn(() => Promise.reject(new Error('test error'))),
    ).toDeepEqual(expectedResult);
  });

  it('resolves to an error if variables were wrong type', async () => {
    const schema = new GraphQLSchema({
      query: DummyQueryType,
      subscription: new GraphQLObjectType({
        name: 'Subscription',
        fields: {
          foo: {
            type: GraphQLString,
            args: { arg: { type: GraphQLInt } },
          },
        },
      }),
    });

    const variableValues = { arg: 'meow' };
    const document = parse(`
      subscription ($arg: Int) {
        foo(arg: $arg)
      }
    `);

    // If we receive variables that cannot be coerced correctly, subscribe() will
    // resolve to an ExecutionResult that contains an informative error description.
    const result = await subscribe({ schema, document, variableValues });
    expectJSON(result).toDeepEqual({
      errors: [
        {
          message:
            'Variable "$arg" got invalid value "meow"; Int cannot represent non-integer value: "meow"',
          locations: [{ line: 2, column: 21 }],
        },
      ],
    });
  });
});

// Once a subscription returns a valid AsyncIterator, it can still yield errors.
describe('Subscription Publish Phase', () => {
  it('produces a payload for multiple subscribe in same subscription', async () => {
    const pubsub = new SimplePubSub<Email>();

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
    const pubsub = new SimplePubSub<Email>();
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

  it('produces a payload when there are multiple events', async () => {
    const pubsub = new SimplePubSub<Email>();
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
    const pubsub = new SimplePubSub<Email>();
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
    await subscription.return();

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
    const pubsub = new SimplePubSub<Email>();
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
      /* c8 ignore next */
      await subscription.throw('ouch');
    } catch (e) {
      caughtError = e;
    }
    expect(caughtError).to.equal('ouch');

    expect(await payload).to.deep.equal({
      done: true,
      value: undefined,
    });
  });

  it('event order is correct for multiple publishes', async () => {
    const pubsub = new SimplePubSub<Email>();
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
    async function* generateMessages() {
      yield 'Hello';
      yield 'Goodbye';
      yield 'Bonjour';
    }

    const schema = new GraphQLSchema({
      query: DummyQueryType,
      subscription: new GraphQLObjectType({
        name: 'Subscription',
        fields: {
          newMessage: {
            type: GraphQLString,
            subscribe: generateMessages,
            resolve(message) {
              if (message === 'Goodbye') {
                throw new Error('Never leave.');
              }
              return message;
            },
          },
        },
      }),
    });

    const document = parse('subscription { newMessage }');
    const subscription = await subscribe({ schema, document });
    invariant(isAsyncIterable(subscription));

    expect(await subscription.next()).to.deep.equal({
      done: false,
      value: {
        data: { newMessage: 'Hello' },
      },
    });

    // An error in execution is presented as such.
    expectJSON(await subscription.next()).toDeepEqual({
      done: false,
      value: {
        data: { newMessage: null },
        errors: [
          {
            message: 'Never leave.',
            locations: [{ line: 1, column: 16 }],
            path: ['newMessage'],
          },
        ],
      },
    });

    // However that does not close the response event stream.
    // Subsequent events are still executed.
    expectJSON(await subscription.next()).toDeepEqual({
      done: false,
      value: {
        data: { newMessage: 'Bonjour' },
      },
    });

    expectJSON(await subscription.next()).toDeepEqual({
      done: true,
      value: undefined,
    });
  });

  it('should pass through error thrown in source event stream', async () => {
    async function* generateMessages() {
      yield 'Hello';
      throw new Error('test error');
    }

    const schema = new GraphQLSchema({
      query: DummyQueryType,
      subscription: new GraphQLObjectType({
        name: 'Subscription',
        fields: {
          newMessage: {
            type: GraphQLString,
            resolve: (message) => message,
            subscribe: generateMessages,
          },
        },
      }),
    });

    const document = parse('subscription { newMessage }');
    const subscription = await subscribe({ schema, document });
    invariant(isAsyncIterable(subscription));

    expect(await subscription.next()).to.deep.equal({
      done: false,
      value: {
        data: { newMessage: 'Hello' },
      },
    });

    (await expectPromise(subscription.next())).toRejectWith('test error');

    expect(await subscription.next()).to.deep.equal({
      done: true,
      value: undefined,
    });
  });
});
