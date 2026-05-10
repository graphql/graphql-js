import { assert, expect } from 'chai';
import { describe, it } from 'mocha';

import { expectEqualPromisesOrValues } from '../../__testUtils__/expectEqualPromisesOrValues.ts';
import { expectJSON } from '../../__testUtils__/expectJSON.ts';
import { expectPromise } from '../../__testUtils__/expectPromise.ts';
import { resolveOnNextTick } from '../../__testUtils__/resolveOnNextTick.ts';
import { spyOnMethod } from '../../__testUtils__/spyOn.ts';

import { isAsyncIterable } from '../../jsutils/isAsyncIterable.ts';
import { isPromise } from '../../jsutils/isPromise.ts';
import { promiseWithResolvers } from '../../jsutils/promiseWithResolvers.ts';

import { parse } from '../../language/parser.ts';

import type { GraphQLResolveInfo } from '../../type/definition.ts';
import {
  GraphQLInterfaceType,
  GraphQLNonNull,
  GraphQLObjectType,
} from '../../type/definition.ts';
import { GraphQLString } from '../../type/scalars.ts';
import { GraphQLSchema } from '../../type/schema.ts';

import { buildSchema } from '../../utilities/buildASTSchema.ts';

import { AbortedGraphQLExecutionError } from '../AbortedGraphQLExecutionError.ts';
import {
  execute,
  experimentalExecuteIncrementally,
  subscribe,
} from '../execute.ts';
import { legacyExecuteIncrementally } from '../legacyIncremental/legacyExecuteIncrementally.ts';

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
    aborter: String
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

  it('rejects with the aborted execution error while initial result is pending', async () => {
    const abortController = new AbortController();
    const abortReason = new Error('Custom abort error');
    const { promise: fieldValue, resolve: resolveFieldValue } =
      promiseWithResolvers<string>();
    const { promise: fieldStarted, resolve: resolveFieldStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    const document = parse(`
      query {
        blocker
      }
    `);

    const resultPromise = execute({
      document,
      schema,
      abortSignal: abortController.signal,
      rootValue: {
        blocker: () => {
          resolveFieldStarted(undefined);
          return fieldValue;
        },
      },
    });

    await fieldStarted;
    abortController.abort(abortReason);

    const caughtError =
      await expectPromise(resultPromise).toRejectWith('Custom abort error');

    assert(caughtError instanceof AbortedGraphQLExecutionError);
    expect(caughtError.cause).to.equal(abortReason);
    assert(isPromise(caughtError.abortedResult));

    let resultSettled = false;
    const promisedResult = caughtError.abortedResult.then((result) => {
      resultSettled = true;
      return result;
    });
    await resolveOnNextTick();
    expect(resultSettled).to.equal(false);

    resolveFieldValue('ok');

    const result = await promisedResult;
    expectJSON(result).toDeepEqual({
      data: { blocker: null },
      errors: [
        {
          message: 'Aborted!',
          path: ['blocker'],
          locations: [{ line: 3, column: 9 }],
        },
      ],
    });
  });

  it('throws the aborted execution error with a completed initial result in the atypical internal resolver-abort case', async () => {
    const abortController = new AbortController();
    const abortReason = new Error('Custom abort error');
    const document = parse(`
      query {
        aborter
      }
    `);

    const caughtError = await expectPromise(
      Promise.resolve().then(() =>
        execute({
          document,
          schema,
          abortSignal: abortController.signal,
          rootValue: {
            aborter: () => {
              abortController.abort(abortReason);
              return 'done';
            },
          },
        }),
      ),
    ).toRejectWith('Custom abort error');

    assert(caughtError instanceof AbortedGraphQLExecutionError);
    expect(caughtError.cause).to.equal(abortReason);
    expect(isPromise(caughtError.abortedResult)).to.equal(false);
    expectJSON(caughtError.abortedResult).toDeepEqual({
      data: {
        aborter: 'done',
      },
    });
  });

  it('throws the aborted execution error with an external abort while incremental initial result is still pending', async () => {
    await expectEqualPromisesOrValues(
      [experimentalExecuteIncrementally, legacyExecuteIncrementally].map(
        async (executeIncrementally) => {
          const abortController = new AbortController();
          const abortReason = new Error('Custom abort error');

          const { promise: delayedAborter, resolve: resolveAborter } =
            promiseWithResolvers<string>();
          const { promise: fieldStarted, resolve: resolveFieldStarted } =
            // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
            promiseWithResolvers<void>();

          delayedAborter.then(
            () => {
              abortController.abort(abortReason);
            },
            () => {
              abortController.abort(abortReason);
            },
          );

          const executionResult = Promise.resolve().then(() =>
            executeIncrementally({
              schema,
              document: parse(`
                query {
                  todo {
                    id
                    ... @defer {
                      items
                    }
                  }
                  aborter
                }
              `),
              abortSignal: abortController.signal,
              rootValue: {
                aborter() {
                  resolveFieldStarted(undefined);
                  return delayedAborter;
                },
                todo: {
                  id: '1',
                  items: ['a'],
                },
              },
            }),
          );

          await fieldStarted;
          resolveAborter('done');

          const caughtError =
            await expectPromise(executionResult).toRejectWith(
              'Custom abort error',
            );

          assert(caughtError instanceof AbortedGraphQLExecutionError);
          expect(caughtError.cause).to.equal(abortReason);
          expect(isPromise(caughtError.abortedResult)).to.equal(true);

          const abortedResult = await caughtError.abortedResult;
          expect(abortedResult.initialResult).to.be.an('object');
        },
      ),
    );
  });

  it('does not wrap aborts after the initial result', async () => {
    const abortController = new AbortController();
    const { promise: deferredItems } =
      promiseWithResolvers<ReadonlyArray<string>>();

    const result = await experimentalExecuteIncrementally({
      schema,
      document: parse(`
        query {
          todo {
            id
            ... @defer {
              items
            }
          }
        }
      `),
      enableEarlyExecution: true,
      abortSignal: abortController.signal,
      rootValue: {
        todo: {
          id: '1',
          items: () => deferredItems,
        },
      },
    });

    assert('initialResult' in result);
    const iterator = result.subsequentResults[Symbol.asyncIterator]();
    abortController.abort();

    const caughtError = await expectPromise(iterator.next()).toRejectWith(
      'This operation was aborted',
    );

    expect(caughtError).not.to.be.an.instanceOf(AbortedGraphQLExecutionError);
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

  it('should stop late sibling object completion after non-null bubbling returns a response', async () => {
    const { promise: boomPromise, reject: rejectBoom } =
      promiseWithResolvers<string>();
    const { promise: sidePromise, resolve: resolveSide } =
      promiseWithResolvers<{
        value: () => string;
      }>();
    const sideType = new GraphQLObjectType({
      name: 'LateSide',
      fields: {
        value: { type: GraphQLString },
      },
    });

    const parentType = new GraphQLObjectType({
      name: 'LateParent',
      fields: {
        boom: {
          type: new GraphQLNonNull(GraphQLString),
          resolve: () => boomPromise,
        },
        side: {
          type: sideType,
          resolve: () => sidePromise,
        },
      },
    });

    const bubbleSchema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'LateQuery',
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

    const document = parse('{ parent { boom side { value } } other }');
    const resultPromise = execute({ schema: bubbleSchema, document });

    rejectBoom(new Error('boom'));
    // wait for boom to bubble up
    await resolveOnNextTick();
    await resolveOnNextTick();
    await resolveOnNextTick();
    const result = await resultPromise;
    const lateSide = {
      value: () => 'late value',
    };
    const lateValueSpy = spyOnMethod(lateSide, 'value');
    resolveSide(lateSide);
    await resolveOnNextTick();
    await resolveOnNextTick();
    expect(lateValueSpy.callCount).to.equal(0);

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

  it('should stop the execution when aborted before cancellation is wired', async () => {
    const abortController = new AbortController();
    const document = parse(`
      query {
        blocker
      }
    `);

    const resultPromise = execute({
      document,
      schema,
      abortSignal: abortController.signal,
      rootValue: {
        blocker: () => {
          abortController.abort(new Error('Custom abort error'));
          return new Promise(() => {
            /* will never resolve */
          });
        },
      },
    });

    await expectPromise(resultPromise).toRejectWith('Custom abort error');
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
    const asyncIterator = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next() {
        resolveNextStarted();
        return nextReturned;
      },
      return() {
        throw new Error('Return failed');
      },
    };
    const returnSpy = spyOnMethod(asyncIterator, 'return');

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
    expect(returnSpy.callCount).to.equal(1);
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
    const asyncIterator = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next() {
        resolveNextStarted();
        return nextReturned;
      },
      return() {
        return Promise.reject(new Error('Return failed'));
      },
    };
    const returnSpy = spyOnMethod(asyncIterator, 'return');

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
    expect(returnSpy.callCount).to.equal(1);
  });
});
