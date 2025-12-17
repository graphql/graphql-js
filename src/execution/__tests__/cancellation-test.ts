import { assert, expect } from 'chai';
import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON.js';
import { expectPromise } from '../../__testUtils__/expectPromise.js';
import { resolveOnNextTick } from '../../__testUtils__/resolveOnNextTick.js';

import { isAsyncIterable } from '../../jsutils/isAsyncIterable.js';
import { promiseWithResolvers } from '../../jsutils/promiseWithResolvers.js';

import type { DocumentNode } from '../../language/ast.js';
import { parse } from '../../language/parser.js';

import {
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from '../../type/definition.js';
import { GraphQLString } from '../../type/scalars.js';
import { GraphQLSchema } from '../../type/schema.js';

import { buildSchema } from '../../utilities/buildASTSchema.js';

import {
  execute,
  experimentalExecuteIncrementally,
  subscribe,
} from '../entrypoints.js';
import type {
  InitialIncrementalExecutionResult,
  SubsequentIncrementalExecutionResult,
} from '../execute.js';

async function complete(
  document: DocumentNode,
  rootValue: unknown,
  abortSignal: AbortSignal,
) {
  const result = await experimentalExecuteIncrementally({
    schema,
    document,
    rootValue,
    abortSignal,
  });

  if ('initialResult' in result) {
    const results: Array<
      InitialIncrementalExecutionResult | SubsequentIncrementalExecutionResult
    > = [result.initialResult];
    for await (const patch of result.subsequentResults) {
      results.push(patch);
    }
    return results;
  }
}

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

const streamQuery = new GraphQLObjectType({
  fields: {
    scalarList: {
      type: new GraphQLList(GraphQLString),
    },
    slowScalarList: {
      type: new GraphQLList(GraphQLString),
    },
  },
  name: 'StreamQuery',
});

const streamSchema = new GraphQLSchema({ query: streamQuery });

const cancelStreamUserType = new GraphQLObjectType({
  name: 'CancelStreamUser',
  fields: {
    id: { type: GraphQLString },
  },
});

const cancelStreamTodoType = new GraphQLObjectType({
  name: 'CancelStreamTodo',
  fields: {
    id: { type: GraphQLString },
    items: { type: new GraphQLList(GraphQLString) },
    author: { type: cancelStreamUserType },
  },
});

const cancelStreamSchema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'CancelStreamQuery',
    fields: {
      todos: { type: new GraphQLList(cancelStreamTodoType) },
    },
  }),
});

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
          id: (_args: any, _context: any, info: { abortSignal: AbortSignal }) =>
            cancellableAsyncFn(info.abortSignal),
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

  it('should allow deferred execution when not aborted', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          id
          ... on Todo @defer {
            author {
              id
            }
          }
        }
      }
    `);

    const result = await experimentalExecuteIncrementally({
      document,
      schema,
      rootValue: {
        todo: {
          author: { id: '1' },
        },
      },
      abortSignal: abortController.signal,
    });

    assert('initialResult' in result);

    const { initialResult, subsequentResults } = result;

    expectJSON(initialResult).toDeepEqual({
      data: {
        todo: {
          id: null,
        },
      },
      pending: [{ id: '0', path: ['todo'] }],
      hasNext: true,
    });

    const payload1 = await subsequentResults.next();
    expectJSON(payload1).toDeepEqual({
      done: false,
      value: {
        incremental: [
          {
            data: { author: { id: '1' } },
            id: '0',
          },
        ],
        completed: [{ id: '0' }],
        hasNext: false,
      },
    });
  });

  it('should stop deferred execution when aborted', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          id
          ... on Todo @defer {
            author {
              id
            }
          }
        }
      }
    `);

    const resultPromise = execute({
      document,
      schema,
      rootValue: {
        todo: async () =>
          Promise.resolve({
            id: '1',
            /* c8 ignore next */
            author: () => expect.fail('Should not be called'),
          }),
      },
      abortSignal: abortController.signal,
    });

    abortController.abort();

    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );
  });

  it('should stop deferred execution when aborted mid-execution', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        ... on Query @defer {
          todo {
            id
            author {
              id
            }
          }
        }
      }
    `);

    const resultPromise = complete(
      document,
      {
        todo: () =>
          Promise.resolve({
            id: '1',
            /* c8 ignore next 2 */
            author: () =>
              Promise.resolve(() => expect.fail('Should not be called')),
          }),
      },
      abortController.signal,
    );

    abortController.abort();

    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );
  });

  it('should stop streamed execution when aborted', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          id
          items @stream
        }
      }
    `);

    const resultPromise = complete(
      document,
      {
        todo: {
          id: '1',
          items: [Promise.resolve('item')],
        },
      },
      abortController.signal,
    );

    abortController.abort();

    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );
  });

  it('cancels streaming when aborted during async iterator next', async () => {
    const abortController = new AbortController();
    const document = parse('{ scalarList @stream(initialCount: 0) }');

    const { promise: nextStarted, resolve: resolveNextStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    const { promise: nextReturned, resolve: resolveNextReturned } =
      promiseWithResolvers<IteratorResult<unknown>>();
    let done = false;
    const asyncIterator = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next() {
        if (done) {
          return Promise.resolve({ value: undefined, done: true });
        }
        done = true;
        resolveNextStarted();
        return nextReturned;
      },
    };

    const result = await experimentalExecuteIncrementally({
      schema: streamSchema,
      document,
      rootValue: {
        scalarList: () => asyncIterator,
      },
      abortSignal: abortController.signal,
    });
    assert('initialResult' in result);

    const iterator = result.subsequentResults[Symbol.asyncIterator]();
    const nextPromise = iterator.next();
    await nextStarted;
    abortController.abort();

    resolveNextReturned({ value: 'value', done: false });
    await expectPromise(nextPromise).toRejectWith('This operation was aborted');
  });

  it('cancels streaming when aborted while item promise is pending', async () => {
    const abortController = new AbortController();
    const document = parse('{ scalarList @stream(initialCount: 0) }');

    const { promise: itemPromise, resolve: resolveItem } =
      promiseWithResolvers<string>();
    const { promise: nextStarted, resolve: resolveNextStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    let done = false;
    const asyncIterator = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next() {
        if (done) {
          return Promise.resolve({ value: undefined, done: true });
        }
        done = true;
        resolveNextStarted();
        return Promise.resolve({ value: itemPromise, done: false });
      },
    };

    const result = await experimentalExecuteIncrementally({
      schema: streamSchema,
      document,
      rootValue: {
        scalarList: () => asyncIterator,
      },
      abortSignal: abortController.signal,
    });
    assert('initialResult' in result);

    const iterator = result.subsequentResults[Symbol.asyncIterator]();
    const nextPromise = iterator.next();
    await nextStarted;
    abortController.abort();

    resolveItem('value');
    await expectPromise(nextPromise).toRejectWith('This operation was aborted');
  });

  it('stops when the stream queue is back-pressured and the consumer cancels', async () => {
    const document = parse('{ scalarList @stream(initialCount: 0) }');
    const { promise: reachedCapacity, resolve: resolveReachedCapacity } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    let count = 0;
    let done = false;
    const iterator = {
      [Symbol.iterator]() {
        return this;
      },
      next() {
        if (done) {
          return { value: undefined, done: true };
        }
        count += 1;
        if (count === 100) {
          resolveReachedCapacity();
        }
        if (count > 100) {
          done = true;
        }
        return { value: String(count), done: false };
      },
    };

    const result = await experimentalExecuteIncrementally({
      schema: streamSchema,
      document,
      rootValue: {
        scalarList: () => iterator,
      },
      enableEarlyExecution: true,
    });
    assert('initialResult' in result);

    await reachedCapacity;
    await resolveOnNextTick();
    const stream = result.subsequentResults[Symbol.asyncIterator]();
    await expectPromise(stream.return()).toResolve();
  });

  it('cancels pending deferred execution groups', async () => {
    const abortController = new AbortController();
    const { promise: slowPromise } = promiseWithResolvers<unknown>();
    const document = parse('{ scalarList ... @defer { slowScalarList } }');

    const result = await experimentalExecuteIncrementally({
      schema: streamSchema,
      document,
      rootValue: {
        scalarList: () => ['a'],
        slowScalarList: () => slowPromise,
      },
      enableEarlyExecution: true,
      abortSignal: abortController.signal,
    });
    assert('initialResult' in result);

    const iterator = result.subsequentResults[Symbol.asyncIterator]();
    abortController.abort();

    await expectPromise(iterator.next()).toRejectWith(
      'This operation was aborted',
    );
  });

  it('cancels tasks and streams when aborted before initial execution finishes', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          id
          items @stream(initialCount: 0)
          ... @defer {
            author {
              id
            }
          }
        }
        blocker
      }
    `);

    const { promise: blockerPromise, resolve: resolveBlocker } =
      promiseWithResolvers<string>();
    const { promise: blockerStarted, resolve: resolveBlockerStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    const { promise: itemsStarted, resolve: resolveItemsStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();

    const resultPromise = experimentalExecuteIncrementally({
      schema,
      document,
      abortSignal: abortController.signal,
      rootValue: {
        blocker() {
          resolveBlockerStarted();
          return blockerPromise;
        },
        todo: {
          id: 'todo',
          items() {
            resolveItemsStarted();
            return ['a', 'b'];
          },
          author() {
            return { id: 'author' };
          },
        },
      },
    });

    await itemsStarted;
    await blockerStarted;

    abortController.abort();

    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );

    resolveBlocker('done');
  });

  it('should ignore repeated cancellation attempts during incremental execution', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          id
          items @stream(initialCount: 0)
          ... @defer {
            author {
              id
            }
          }
        }
      }
    `);

    let streamReturnCount = 0;
    let nextPromiseResolved = false;
    const { promise: nextStarted, resolve: resolveNextStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    const { promise: nextPromise, resolve: resolveNext } =
      promiseWithResolvers<IteratorResult<string>>();
    const asyncIterator = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next() {
        if (nextPromiseResolved) {
          return Promise.resolve({ value: undefined, done: true });
        }
        nextPromiseResolved = true;
        resolveNextStarted();
        return nextPromise;
      },
      return() {
        streamReturnCount += 1;
        return Promise.resolve({ value: undefined, done: true });
      },
    };

    const { promise: authorStarted, resolve: resolveAuthorStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    const { promise: authorPromise, resolve: resolveAuthor } =
      promiseWithResolvers<{ id: string }>();
    const rootValue = {
      todo: {
        id: 'todo',
        items: () => asyncIterator,
        author() {
          resolveAuthorStarted();
          return authorPromise;
        },
      },
    };

    const result = await experimentalExecuteIncrementally({
      schema,
      document,
      rootValue,
      enableEarlyExecution: true,
      abortSignal: abortController.signal,
    });
    assert('initialResult' in result);

    const iterator = result.subsequentResults[Symbol.asyncIterator]();
    const nextResultPromise = iterator.next();

    await authorStarted;
    await nextStarted;

    abortController.abort();
    await resolveOnNextTick();

    let firstResult:
      | IteratorResult<SubsequentIncrementalExecutionResult>
      | undefined;
    try {
      firstResult =
        (await nextResultPromise) as IteratorResult<SubsequentIncrementalExecutionResult>;
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.equal('This operation was aborted');
    }
    if (firstResult && !firstResult.done) {
      try {
        const followUp = await iterator.next();
        expect(followUp.done).to.equal(true);
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.equal('This operation was aborted');
      }
    }
    expect(streamReturnCount).to.equal(1);

    const priorStreamReturnCount = streamReturnCount;
    abortController.abort();
    await resolveOnNextTick();

    expect(streamReturnCount).to.equal(priorStreamReturnCount);

    resolveNext({ value: 'value', done: false });
    resolveAuthor({ id: 'author' });
  });

  it('should ignore deferred payloads resolved after cancellation', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          id
          ... @defer {
            author {
              id
            }
          }
        }
      }
    `);

    const { promise: authorStarted, resolve: resolveAuthorStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    const { promise: authorPromise, resolve: resolveAuthor } =
      promiseWithResolvers<{ id: string }>();

    const result = await experimentalExecuteIncrementally({
      schema,
      document,
      abortSignal: abortController.signal,
      enableEarlyExecution: true,
      rootValue: {
        todo: {
          id: 'todo',
          author() {
            resolveAuthorStarted();
            return authorPromise;
          },
        },
      },
    });
    assert('initialResult' in result);

    const iterator = result.subsequentResults[Symbol.asyncIterator]();
    const nextResultPromise = iterator.next();

    await authorStarted;
    abortController.abort();

    resolveAuthor({ id: 'author' });

    await expectPromise(nextResultPromise).toRejectWith(
      'This operation was aborted',
    );
    await expectPromise(authorPromise).toResolve();
  });

  it('should ignore deferred errors after cancellation', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        todo {
          id
          ... @defer {
            author {
              id
            }
          }
        }
      }
    `);

    const { promise: authorStarted, resolve: resolveAuthorStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    const { promise: authorPromise, reject: rejectAuthor } =
      promiseWithResolvers<{ id: string }>();

    const result = await experimentalExecuteIncrementally({
      schema,
      document,
      abortSignal: abortController.signal,
      enableEarlyExecution: true,
      rootValue: {
        todo: {
          id: 'todo',
          author() {
            resolveAuthorStarted();
            return authorPromise;
          },
        },
      },
    });
    assert('initialResult' in result);

    const iterator = result.subsequentResults[Symbol.asyncIterator]();
    const nextResultPromise = iterator.next();

    await authorStarted;
    abortController.abort();

    rejectAuthor(new Error('late error'));

    await expectPromise(nextResultPromise).toRejectWith(
      'This operation was aborted',
    );
    await expectPromise(authorPromise).toRejectWith('late error');
  });

  it('cancels stream item executors with deferred work and nested streams', async () => {
    const document = parse(`
      query {
        todos @stream(initialCount: 0) {
          id
          items @stream(initialCount: 0)
          ... @defer {
            author {
              id
            }
          }
        }
      }
    `);

    const { promise: idPromise, resolve: resolveId } =
      promiseWithResolvers<string>();
    const { promise: idStarted, resolve: resolveIdStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();

    const result = await experimentalExecuteIncrementally({
      schema: cancelStreamSchema,
      document,
      enableEarlyExecution: true,
      rootValue: {
        todos: [
          {
            id() {
              resolveIdStarted();
              return idPromise;
            },
            items: ['a'],
            author: { id: 'author' },
          },
        ],
      },
    });
    assert('initialResult' in result);

    const iterator = result.subsequentResults[Symbol.asyncIterator]();
    await idStarted;
    await expectPromise(iterator.return()).toResolve();
    await resolveOnNextTick();

    resolveId('todo');
    await resolveOnNextTick();
  });

  it('stops streaming when a pending stream item resolves after cancellation', async () => {
    const document = parse('{ scalarList @stream(initialCount: 0) }');
    const { promise: itemPromise, resolve: resolveItem } =
      promiseWithResolvers<string>();
    const { promise: nextStarted, resolve: resolveNextStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    let done = false;
    const iterator = {
      [Symbol.iterator]() {
        return this;
      },
      next() {
        if (done) {
          return { value: undefined, done: true };
        }
        done = true;
        resolveNextStarted();
        return { value: itemPromise, done: false };
      },
    };

    const result = await experimentalExecuteIncrementally({
      schema: streamSchema,
      document,
      rootValue: {
        scalarList: () => iterator,
      },
    });
    assert('initialResult' in result);

    const stream = result.subsequentResults[Symbol.asyncIterator]();
    const nextPromise = stream.next();

    await nextStarted;
    const returnPromise = stream.return();
    await resolveOnNextTick();

    resolveItem('value');

    await expectPromise(returnPromise).toResolve();
    await expectPromise(nextPromise).toResolve();
  });
});
