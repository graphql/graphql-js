import { describe, it } from 'node:test';

import { assert, expect } from 'chai';

import { expectPromise } from '../../__testUtils__/expectPromise.ts';
import { resolveOnNextTick } from '../../__testUtils__/resolveOnNextTick.ts';
import { spyOn } from '../../__testUtils__/spyOn.ts';

import { isPromise } from '../../jsutils/isPromise.ts';
import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.ts';
import { promiseWithResolvers } from '../../jsutils/promiseWithResolvers.ts';

import { parse } from '../../language/parser.ts';

import type { GraphQLResolveInfo } from '../../type/definition.ts';
import { GraphQLObjectType } from '../../type/definition.ts';
import { GraphQLString } from '../../type/scalars.ts';
import { GraphQLSchema } from '../../type/schema.ts';

import { buildSchema } from '../../utilities/buildASTSchema.ts';

import type { SharedExecutionContext } from '../createSharedExecutionContext.ts';
import type { ExecutionArgs } from '../execute.ts';
import { execute, experimentalExecuteIncrementally } from '../execute.ts';
import type { ExecutionResult, ValidatedExecutionArgs } from '../Executor.ts';
import { runAsyncWorkFinishedHook } from '../hooks.ts';

const executeHookSchema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      test: {
        type: GraphQLString,
        resolve: () => 'ok',
      },
    },
  }),
});

const cancellationHookSchema = buildSchema(`
  type Todo {
    id: ID
    items: [String]
  }

  type Query {
    todo: Todo
  }
`);

function executeAndWaitForAsyncWorkFinished(
  args: ExecutionArgs,
): PromiseOrValue<ExecutionResult> {
  const userAsyncWorkFinishedHook = args.hooks?.asyncWorkFinished;
  const { promise: hookFinished, resolve: resolveHookFinished } =
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    promiseWithResolvers<void>();
  let hookHasFired = false;

  const result = execute({
    ...args,
    hooks: {
      ...args.hooks,
      asyncWorkFinished(info) {
        try {
          userAsyncWorkFinishedHook?.(info);
        } finally {
          hookHasFired = true;
          resolveHookFinished();
        }
      },
    },
  });

  return hookHasFired ? result : hookFinished.then(() => result);
}

describe('Execute: Hooks', () => {
  it('ignores errors thrown by hooks', async () => {
    const calls: Array<string> = [];
    const { promise: hooksFinished, resolve: resolveHooksFinished } =
      promiseWithResolvers<undefined>();

    const result = execute({
      schema: executeHookSchema,
      document: parse('{ test }'),
      hooks: {
        asyncWorkFinished() {
          calls.push('asyncWork');
          resolveHooksFinished(undefined);
          throw new Error('asyncWorkFinished failed');
        },
      },
    });

    expect(result).to.deep.equal({
      data: {
        test: 'ok',
      },
    });
    await hooksFinished;
    expect(calls).to.deep.equal(['asyncWork']);
  });

  it('runs post execution hooks synchronously when no async work is tracked', () => {
    const calls: Array<string> = [];

    const result = execute({
      schema: executeHookSchema,
      document: parse('{ test }'),
      hooks: {
        asyncWorkFinished() {
          calls.push('asyncWork');
        },
      },
    });

    expect(result).to.deep.equal({
      data: {
        test: 'ok',
      },
    });
    expect(calls).to.deep.equal(['asyncWork']);
  });

  it('runs post execution hooks for asynchronous execution', async () => {
    const { promise: resolvedValue, resolve } = promiseWithResolvers<string>();
    const calls: Array<string> = [];
    const { promise: hooksFinished, resolve: resolveHooksFinished } =
      promiseWithResolvers<undefined>();
    const asyncSchema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          test: {
            type: GraphQLString,
            resolve: () => resolvedValue,
          },
        },
      }),
    });

    const resultPromise = execute({
      schema: asyncSchema,
      document: parse('{ test }'),
      hooks: {
        asyncWorkFinished() {
          calls.push('asyncWork');
          resolveHooksFinished(undefined);
        },
      },
    });

    expect(calls).to.deep.equal([]);
    resolve('ok');

    const result = await resultPromise;
    expect(result).to.deep.equal({
      data: {
        test: 'ok',
      },
    });
    await hooksFinished;
    expect(calls).to.deep.equal(['asyncWork']);
  });

  it('ignores async-work tracker wait rejection', async () => {
    const validatedExecutionArgs = {} as unknown as ValidatedExecutionArgs;
    const sharedExecutionContext = {
      asyncWorkTracker: {
        wait() {
          return Promise.reject(new Error('tracker failed'));
        },
      },
    } as unknown as SharedExecutionContext;

    let hookCalled = false;
    runAsyncWorkFinishedHook(
      validatedExecutionArgs,
      sharedExecutionContext,
      () => {
        hookCalled = true;
      },
    );

    await resolveOnNextTick();
    expect(hookCalled).to.equal(false);
  });

  it('does not wait for un-awaited promiseAll helper usage before asyncWorkFinished', async () => {
    const { promise: pendingCleanup, resolve: resolveCleanup } =
      promiseWithResolvers<undefined>();
    const { promise: asyncWorkFinished, resolve: resolveAsyncWorkFinished } =
      promiseWithResolvers<undefined>();
    const sideEffectPromiseAllSchema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          test: {
            type: GraphQLString,
            resolve: (_source, _args, _context, info: GraphQLResolveInfo) => {
              // Anti-pattern: promiseAll used as un-awaited async side-effect.
              // Tracking starts in a later microtask, so asyncWorkFinished
              // can run before the sibling promise is observed.
              info
                .getAsyncHelpers()
                .promiseAll([Promise.reject(new Error('bad')), pendingCleanup])
                .catch(() => undefined);
              return 'ok';
            },
          },
        },
      }),
    });

    const result = execute({
      schema: sideEffectPromiseAllSchema,
      document: parse('{ test }'),
      hooks: {
        asyncWorkFinished() {
          resolveAsyncWorkFinished(undefined);
        },
      },
    });

    expect(result).to.deep.equal({
      data: {
        test: 'ok',
      },
    });

    await asyncWorkFinished;

    let cleanupSettled = false;
    const cleanupObserved = pendingCleanup.then(() => {
      cleanupSettled = true;
    });
    await resolveOnNextTick();
    expect(cleanupSettled).to.equal(false);

    resolveCleanup(undefined);
    await cleanupObserved;
  });

  it('waits for track(...) helper usage before asyncWorkFinished', async () => {
    const { promise: pendingCleanup, resolve: resolveCleanup } =
      promiseWithResolvers<undefined>();
    const { promise: asyncWorkFinished, resolve: resolveAsyncWorkFinished } =
      promiseWithResolvers<undefined>();
    const trackedSideEffectSchema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          test: {
            type: GraphQLString,
            resolve: (_source, _args, _context, info: GraphQLResolveInfo) => {
              info
                .getAsyncHelpers()
                .track([pendingCleanup.catch(() => undefined)]);
              return 'ok';
            },
          },
        },
      }),
    });

    const result = execute({
      schema: trackedSideEffectSchema,
      document: parse('{ test }'),
      hooks: {
        asyncWorkFinished() {
          resolveAsyncWorkFinished(undefined);
        },
      },
    });

    expect(result).to.deep.equal({
      data: {
        test: 'ok',
      },
    });

    let hookSettled = false;
    const hookObserved = asyncWorkFinished.then(() => {
      hookSettled = true;
    });
    await resolveOnNextTick();
    expect(hookSettled).to.equal(false);

    resolveCleanup(undefined);
    await hookObserved;
    expect(hookSettled).to.equal(true);
  });

  it('wrapper returns synchronously when asyncWorkFinished fires during execute', () => {
    const calls: Array<string> = [];
    const wrappedResult = executeAndWaitForAsyncWorkFinished({
      schema: executeHookSchema,
      document: parse('{ test }'),
      hooks: {
        asyncWorkFinished() {
          calls.push('asyncWork');
        },
      },
    });

    assert(!isPromise(wrappedResult));
    expect(wrappedResult).to.deep.equal({
      data: {
        test: 'ok',
      },
    });
    expect(calls).to.deep.equal(['asyncWork']);
  });

  it('wrapper returns a promise and resolves after asyncWorkFinished for track(...) side effects', async () => {
    const { promise: pendingCleanup, resolve: resolveCleanup } =
      promiseWithResolvers<undefined>();
    const calls: Array<string> = [];
    const trackedSideEffectSchema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          test: {
            type: GraphQLString,
            resolve: (_source, _args, _context, info: GraphQLResolveInfo) => {
              info.getAsyncHelpers().track([pendingCleanup]);
              return 'ok';
            },
          },
        },
      }),
    });

    const wrappedResult = executeAndWaitForAsyncWorkFinished({
      schema: trackedSideEffectSchema,
      document: parse('{ test }'),
      hooks: {
        asyncWorkFinished() {
          calls.push('asyncWork');
        },
      },
    });

    assert(isPromise(wrappedResult));
    expect(calls).to.deep.equal([]);

    let settled = false;
    wrappedResult.then(
      () => {
        settled = true;
      },
      () => undefined,
    );
    await resolveOnNextTick();
    expect(settled).to.equal(false);
    expect(calls).to.deep.equal([]);

    resolveCleanup(undefined);

    const result = await wrappedResult;
    expect(result).to.deep.equal({
      data: {
        test: 'ok',
      },
    });
    expect(calls).to.deep.equal(['asyncWork']);
  });

  it('runs post execution hooks for aborted execution', async () => {
    const abortController = new AbortController();
    const { promise: pendingCleanup, resolve: resolveCleanup } =
      promiseWithResolvers<string>();
    const { promise: asyncWorkFinished, resolve: resolveAsyncWorkFinished } =
      promiseWithResolvers<undefined>();
    const calls: Array<string> = [];
    const document = parse(`
      query {
        todo {
          id
        }
      }
    `);

    const resultPromise = execute({
      document,
      schema: cancellationHookSchema,
      abortSignal: abortController.signal,
      hooks: {
        asyncWorkFinished() {
          calls.push('asyncWork');
          resolveAsyncWorkFinished(undefined);
        },
      },
      rootValue: {
        todo: (_args: any, _context: any, info: GraphQLResolveInfo) => {
          const abortSignal = info.getAbortSignal();
          assert(abortSignal instanceof AbortSignal);
          const abortPromise = new Promise<never>((_resolve, reject) => {
            abortSignal.addEventListener('abort', () => {
              reject(new Error('This operation was aborted'));
            });
          });
          return info
            .getAsyncHelpers()
            .promiseAll([abortPromise, pendingCleanup]);
        },
      },
    });

    abortController.abort();
    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );
    expect(calls).to.deep.equal([]);

    resolveCleanup('done');
    await asyncWorkFinished;

    expect(calls).to.deep.equal(['asyncWork']);
  });

  it('fires asyncWorkFinished after async iterator return cleanup', async () => {
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
    const { promise: returnStarted, resolve: resolveReturnStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    const { promise: returnFinished, resolve: resolveReturnFinished } =
      promiseWithResolvers<IteratorResult<string>>();
    const { promise: asyncWorkFinished, resolve: resolveAsyncWorkFinished } =
      promiseWithResolvers<undefined>();
    const asyncIterator = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next() {
        resolveNextStarted(undefined);
        return nextReturned;
      },
      return() {
        resolveReturnStarted(undefined);
        return returnFinished;
      },
    };

    const resultPromise = execute({
      schema: cancellationHookSchema,
      document,
      abortSignal: abortController.signal,
      hooks: {
        asyncWorkFinished() {
          resolveAsyncWorkFinished(undefined);
        },
      },
      rootValue: {
        todo: {
          items: asyncIterator,
        },
      },
    });

    await nextStarted;
    abortController.abort();
    resolveNextReturned({ value: 'value', done: false });

    await expectPromise(resultPromise).toRejectWith(
      'This operation was aborted',
    );
    await returnStarted;

    let asyncWorkHookCalled = false;
    const asyncWorkObserved = asyncWorkFinished.then(() => {
      asyncWorkHookCalled = true;
    });
    await resolveOnNextTick();
    expect(asyncWorkHookCalled).to.equal(false);

    resolveReturnFinished({ value: undefined, done: true });
    await asyncWorkFinished;
    await asyncWorkObserved;
  });

  it('fires asyncWorkFinished after all incremental payloads are delivered', async () => {
    const { promise: deferredItems, resolve: resolveDeferredItems } =
      promiseWithResolvers<ReadonlyArray<string>>();
    const { promise: asyncWorkFinished, resolve: resolveAsyncWorkFinished } =
      promiseWithResolvers<undefined>();
    const asyncWorkFinishedSpy = spyOn(() =>
      resolveAsyncWorkFinished(undefined),
    );

    const result = await experimentalExecuteIncrementally({
      schema: cancellationHookSchema,
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
      hooks: {
        asyncWorkFinished: asyncWorkFinishedSpy,
      },
      rootValue: {
        todo: {
          id: '1',
          items: () => deferredItems,
        },
      },
    });

    assert('initialResult' in result);
    expect(result.initialResult.hasNext).to.equal(true);

    let asyncWorkHookCalled = false;
    const asyncWorkObserved = asyncWorkFinished.then(() => {
      asyncWorkHookCalled = true;
    });
    await resolveOnNextTick();
    expect(asyncWorkHookCalled).to.equal(false);

    const nextPromise = result.subsequentResults.next();
    let nextSettled = false;
    nextPromise.then(
      () => {
        nextSettled = true;
      },
      () => {
        nextSettled = true;
      },
    );
    await resolveOnNextTick();
    expect(nextSettled).to.equal(false);
    expect(asyncWorkHookCalled).to.equal(false);

    resolveDeferredItems(['a']);
    const nextResult = await nextPromise;
    expect(nextResult.done).to.equal(false);
    if (nextResult.done) {
      throw new Error('Expected an incremental payload.');
    }
    expect(nextResult.value.hasNext).to.equal(false);
    await asyncWorkFinished;
    await asyncWorkObserved;
    expect(asyncWorkFinishedSpy.callCount).to.equal(1);
  });
});
