import { assert, expect } from 'chai';
import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON.js';
import { expectPromise } from '../../__testUtils__/expectPromise.js';
import { resolveOnNextTick } from '../../__testUtils__/resolveOnNextTick.js';

import { isAsyncIterable } from '../../jsutils/isAsyncIterable.js';
import { promiseWithResolvers } from '../../jsutils/promiseWithResolvers.js';

import { parse } from '../../language/parser.js';

import type { GraphQLResolveInfo } from '../../type/definition.js';
import {
  GraphQLInterfaceType,
  GraphQLNonNull,
  GraphQLObjectType,
} from '../../type/definition.js';
import { GraphQLString } from '../../type/scalars.js';
import { GraphQLSchema } from '../../type/schema.js';

import { buildSchema } from '../../utilities/buildASTSchema.js';

import { execute, subscribe } from '../execute.js';

const schema = buildSchema(`
  type Todo {
    id: ID
    items: [String]
    author: User
  }

  type User {
    id: ID
    name: String
  }

  type Query {
    todo: Todo
    nonNullableTodo: Todo!
    blocker: String
  }

  type Mutation {
    foo: String
    bar: String
  }

  type Subscription {
    foo: String
  }
`);

describe('Execute: Cancellation', () => {
  it('should stop the execution when aborted during object field completion', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          id
          author {
            id
          }
        }
      }
    `);

    const resultPromise = execute({
      document,
      schema,
      abortSignal: abortController.signal,
      rootValue: {
        todo: async () =>
          Promise.resolve({
            id: '1',
            /* c8 ignore next */
            author: () => expect.fail('Should not be called'),
          }),
      },
    });

    abortController.abort();

    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );
  });

  it('should provide access to the abort signal within resolvers', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          id
        }
      }
    `);

    let aborted = false;
    const cancellableAsyncFn = async (abortSignal: AbortSignal) => {
      if (abortSignal.aborted) {
        aborted = true;
      } else {
        abortSignal.addEventListener('abort', () => {
          aborted = true;
        });
      }
      await resolveOnNextTick();
      throw Error('some random other error that does not show up in response');
    };

    const resultPromise = execute({
      document,
      schema,
      abortSignal: abortController.signal,
      rootValue: {
        todo: {
          id: (_args: any, _context: any, info: GraphQLResolveInfo) => {
            const abortSignal = info.getAbortSignal();
            assert(abortSignal instanceof AbortSignal);
            return cancellableAsyncFn(abortSignal);
          },
        },
      },
    });

    abortController.abort();

    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );
    expect(aborted).to.equal(true);
  });

  it('should stop the execution when aborted during object field completion with a custom error', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          id
          author {
            id
          }
        }
      }
    `);

    const resultPromise = execute({
      document,
      schema,
      abortSignal: abortController.signal,
      rootValue: {
        todo: async () =>
          Promise.resolve({
            id: '1',
            /* c8 ignore next */
            author: () => expect.fail('Should not be called'),
          }),
      },
    });

    abortController.abort(new Error('Custom abort error'));

    await expectPromise(resultPromise).toRejectWith('Custom abort error');
  });

  it('should stop the execution when aborted during nested object field completion', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          id
          author {
            id
          }
        }
      }
    `);

    const resultPromise = execute({
      document,
      schema,
      abortSignal: abortController.signal,
      rootValue: {
        todo: {
          id: '1',
          /* c8 ignore next 3 */
          author: async () =>
            Promise.resolve(() => expect.fail('Should not be called')),
        },
      },
    });

    abortController.abort();

    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );
  });

  it('should stop the execution when aborted despite a hanging resolver', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          id
          author {
            id
          }
        }
      }
    `);

    const resultPromise = execute({
      document,
      schema,
      abortSignal: abortController.signal,
      rootValue: {
        todo: () =>
          new Promise(() => {
            /* will never resolve */
          }),
      },
    });

    abortController.abort();

    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );
  });

  it('should stop the execution when aborted despite a hanging item', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          id
          items
        }
      }
    `);

    const resultPromise = execute({
      document,
      schema,
      abortSignal: abortController.signal,
      rootValue: {
        todo: () => ({
          id: '1',
          items: [
            new Promise(() => {
              /* will never resolve */
            }),
          ],
        }),
      },
    });

    abortController.abort();

    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );
  });

  it('should stop the execution when aborted during promised list item completion', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          items
        }
      }
    `);
    const { promise: itemPromise, resolve: resolveItem } =
      promiseWithResolvers<string>();

    const resultPromise = execute({
      document,
      schema,
      abortSignal: abortController.signal,
      rootValue: {
        todo: () => ({
          items: [itemPromise],
        }),
      },
    });

    abortController.abort();
    resolveItem('value');

    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );
  });

  it('should stop the execution when aborted despite a hanging async item', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          id
          items
        }
      }
    `);

    const resultPromise = execute({
      document,
      schema,
      abortSignal: abortController.signal,
      rootValue: {
        todo: () => ({
          id: '1',
          async *items() {
            yield await new Promise(() => {
              /* will never resolve */
            }); /* c8 ignore start */
          } /* c8 ignore stop */,
        }),
      },
    });

    abortController.abort();

    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );
  });

  it('should stop resolving abstract types after aborting', async () => {
    const abortController = new AbortController();
    const { promise: resolveTypePromise, resolve: resolveType } =
      promiseWithResolvers<string>();
    const { promise: resolveTypeStarted, resolve: resolveTypeStartedResolve } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();

    const nodeInterface = new GraphQLInterfaceType({
      name: 'Node',
      fields: {
        id: { type: GraphQLString },
      },
      resolveType() {
        resolveTypeStartedResolve();
        return resolveTypePromise;
      },
    });

    const userType = new GraphQLObjectType({
      name: 'User',
      interfaces: [nodeInterface],
      fields: {
        id: { type: GraphQLString },
      },
    });

    const interfaceSchema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          node: {
            type: nodeInterface,
            resolve: () => ({ id: '1' }),
          },
        },
      }),
      types: [userType],
    });

    const document = parse('{ node { id } }');

    const resultPromise = execute({
      schema: interfaceSchema,
      document,
      abortSignal: abortController.signal,
    });

    await resolveTypeStarted;
    abortController.abort();
    resolveType('User');

    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );
  });

  it('should stop resolving isTypeOf after aborting', async () => {
    const abortController = new AbortController();
    const { promise: isTypeOfPromise, resolve: resolveIsTypeOf } =
      promiseWithResolvers<boolean>();
    const { promise: isTypeOfStarted, resolve: resolveIsTypeOfStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();

    const todoType = new GraphQLObjectType({
      name: 'Todo',
      fields: {
        id: { type: GraphQLString },
      },
      isTypeOf() {
        resolveIsTypeOfStarted();
        return isTypeOfPromise;
      },
    });

    const isTypeOfSchema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          todo: {
            type: todoType,
            resolve: () => ({ id: '1' }),
          },
        },
      }),
    });

    const document = parse('{ todo { id } }');

    const resultPromise = execute({
      schema: isTypeOfSchema,
      document,
      abortSignal: abortController.signal,
    });

    await isTypeOfStarted;
    abortController.abort();
    resolveIsTypeOf(true);

    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );
  });

  it('should stop the execution when aborted with proper null bubbling', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        nonNullableTodo {
          id
          author {
            id
          }
        }
      }
    `);

    const resultPromise = execute({
      document,
      schema,
      abortSignal: abortController.signal,
      rootValue: {
        nonNullableTodo: async () =>
          Promise.resolve({
            id: '1',
            /* c8 ignore next */
            author: () => expect.fail('Should not be called'),
          }),
      },
    });

    abortController.abort();

    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );
  });

  it('suppresses sibling errors after a non-null error bubbles', async () => {
    const { promise: boomPromise, reject: rejectBoom } =
      promiseWithResolvers<string>();
    const { promise: sidePromise, reject: rejectSide } =
      promiseWithResolvers<string>();

    const parentType = new GraphQLObjectType({
      name: 'Parent',
      fields: {
        boom: {
          type: new GraphQLNonNull(GraphQLString),
          resolve: () => boomPromise,
        },
        side: {
          type: GraphQLString,
          resolve: () => sidePromise,
        },
      },
    });

    const bubbleSchema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          parent: {
            type: parentType,
            resolve: () => ({}),
          },
          other: {
            type: GraphQLString,
            resolve: () => 'ok',
          },
        },
      }),
    });

    const document = parse('{ parent { boom side } other }');
    const resultPromise = execute({ schema: bubbleSchema, document });

    rejectBoom(new Error('boom'));
    // wait for boom to bubble up
    await resolveOnNextTick();
    await resolveOnNextTick();
    await resolveOnNextTick();
    rejectSide(new Error('side'));

    const result = await resultPromise;
    expectJSON(result).toDeepEqual({
      data: {
        parent: null,
        other: 'ok',
      },
      errors: [
        {
          message: 'boom',
          locations: [{ line: 1, column: 12 }],
          path: ['parent', 'boom'],
        },
      ],
    });
  });

  it('should stop the execution when aborted mid-mutation', async () => {
    const abortController = new AbortController();
    const document = parse(`
      mutation {
        foo
        bar
      }
    `);

    const resultPromise = execute({
      document,
      schema,
      abortSignal: abortController.signal,
      rootValue: {
        foo: async () => Promise.resolve('baz'),
        /* c8 ignore next */
        bar: () => expect.fail('Should not be called'),
      },
    });

    await resolveOnNextTick();
    await resolveOnNextTick();
    await resolveOnNextTick();

    abortController.abort();

    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );
  });

  it('should stop the execution when aborted pre-execute', () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          id
          author {
            id
          }
        }
      }
    `);
    abortController.abort();

    expect(() =>
      execute({
        document,
        schema,
        abortSignal: abortController.signal,
        rootValue: {
          /* c8 ignore next */
          todo: () => expect.fail('Should not be called'),
        },
      }),
    ).to.throw('This operation was aborted');
  });

  it('should stop the execution when aborted prior to return of a subscription resolver', async () => {
    const abortController = new AbortController();
    const document = parse(`
      subscription {
        foo
      }
    `);

    const subscriptionPromise = subscribe({
      document,
      schema,
      abortSignal: abortController.signal,
      rootValue: {
        foo: async () =>
          new Promise(() => {
            /* will never resolve */
          }),
      },
    });

    abortController.abort();

    const result = await subscriptionPromise;

    expectJSON(result).toDeepEqual({
      errors: [
        {
          message: 'This operation was aborted',
          path: ['foo'],
          locations: [{ line: 3, column: 9 }],
        },
      ],
    });
  });

  it('should successfully wrap the subscription', async () => {
    const abortController = new AbortController();
    const document = parse(`
      subscription {
        foo
      }
    `);

    async function* foo() {
      yield await Promise.resolve({ foo: 'foo' });
    }

    const subscription = await subscribe({
      document,
      schema,
      abortSignal: abortController.signal,
      rootValue: {
        foo: Promise.resolve(foo()),
      },
    });

    assert(isAsyncIterable(subscription));

    expectJSON(await subscription.next()).toDeepEqual({
      value: {
        data: {
          foo: 'foo',
        },
      },
      done: false,
    });

    expectJSON(await subscription.next()).toDeepEqual({
      value: undefined,
      done: true,
    });
  });

  it('should stop the execution when aborted during subscription', async () => {
    const abortController = new AbortController();
    const document = parse(`
      subscription {
        foo
      }
    `);

    async function* foo() {
      yield await Promise.resolve({ foo: 'foo' });
    }

    const subscription = subscribe({
      document,
      schema,
      abortSignal: abortController.signal,
      rootValue: {
        foo: foo(),
      },
    });

    assert(isAsyncIterable(subscription));

    expectJSON(await subscription.next()).toDeepEqual({
      value: {
        data: {
          foo: 'foo',
        },
      },
      done: false,
    });

    abortController.abort();

    await expectPromise(subscription.next()).toRejectWith(
      'This operation was aborted',
    );
  });

  it('should stop the execution when aborted during subscription returned asynchronously', async () => {
    const abortController = new AbortController();
    const document = parse(`
      subscription {
        foo
      }
    `);

    async function* foo() {
      yield await Promise.resolve({ foo: 'foo' });
    }

    const subscription = await subscribe({
      document,
      schema,
      abortSignal: abortController.signal,
      rootValue: {
        foo: Promise.resolve(foo()),
      },
    });

    assert(isAsyncIterable(subscription));

    expectJSON(await subscription.next()).toDeepEqual({
      value: {
        data: {
          foo: 'foo',
        },
      },
      done: false,
    });

    abortController.abort();

    await expectPromise(subscription.next()).toRejectWith(
      'This operation was aborted',
    );
  });

  it('ignores async iterator return errors after aborting list completion', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          items
        }
      }
    `);
    const { promise: nextReturned, resolve: resolveNextReturned } =
      promiseWithResolvers<IteratorResult<string>>();
    const { promise: nextStarted, resolve: resolveNextStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    let returnCalled = false;
    const asyncIterator = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next() {
        resolveNextStarted();
        return nextReturned;
      },
      return() {
        returnCalled = true;
        throw new Error('Return failed');
      },
    };

    const resultPromise = execute({
      schema,
      document,
      rootValue: {
        todo: {
          items: asyncIterator,
        },
      },
      abortSignal: abortController.signal,
    });
    await nextStarted;
    abortController.abort();
    resolveNextReturned({ value: 'value', done: false });

    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );
    expect(returnCalled).to.equal(true);
  });

  it('ignores async iterator return promise rejections after aborting list completion', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          items
        }
      }
    `);
    const { promise: nextReturned, resolve: resolveNextReturned } =
      promiseWithResolvers<IteratorResult<string>>();
    const { promise: nextStarted, resolve: resolveNextStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    let returnCalled = false;
    const asyncIterator = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next() {
        resolveNextStarted();
        return nextReturned;
      },
      return() {
        returnCalled = true;
        return Promise.reject(new Error('Return failed'));
      },
    };

    const resultPromise = execute({
      schema,
      document,
      rootValue: {
        todo: {
          items: asyncIterator,
        },
      },
      abortSignal: abortController.signal,
    });
    await nextStarted;
    abortController.abort();
    resolveNextReturned({ value: 'value', done: false });

    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );
    expect(returnCalled).to.equal(true);
  });
});
