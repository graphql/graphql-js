import { describe, it } from 'node:test';

import { assert, expect } from 'chai';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import { parse } from '../../../language/parser.ts';

import { GraphQLNonNull, GraphQLObjectType } from '../../../type/definition.ts';
import { GraphQLString } from '../../../type/scalars.ts';

import { AbortedGraphQLExecutionError } from '../../AbortedGraphQLExecutionError.ts';
import {
  execute as executeWithoutBatchResolvers,
  executeSync as executeSyncWithoutBatchResolvers,
  validateExecutionArgs,
} from '../../execute.ts';
import { Executor } from '../../Executor.ts';

import {
  batchedField,
  schemaWithQueryFields,
  schemaWithUserFields,
} from './fixtures.ts';

function execute(
  args: Parameters<typeof executeWithoutBatchResolvers>[0],
): ReturnType<typeof executeWithoutBatchResolvers> {
  return executeWithoutBatchResolvers({
    ...args,
    enableBatchResolvers: true,
  });
}

function executeSync(
  args: Parameters<typeof executeSyncWithoutBatchResolvers>[0],
): ReturnType<typeof executeSyncWithoutBatchResolvers> {
  return executeSyncWithoutBatchResolvers({
    ...args,
    enableBatchResolvers: true,
  });
}

describe('Execute: async iterable field batch resolver results', () => {
  it('completes contiguous result chunks before requesting the next chunk', async () => {
    const completedValues: Array<string> = [];
    const friendType = new GraphQLObjectType({
      name: 'AsyncBatchFriend',
      fields: {
        name: {
          type: GraphQLString,
          resolve: (source: any) =>
            Promise.resolve(source.name).then((name: string) => {
              completedValues.push(name);
              return name;
            }),
        },
      },
    });

    async function* resolveFriends() {
      yield await Promise.resolve([{ name: 'Ada' }]);
      expect(completedValues).to.deep.equal(['Ada']);

      yield [];
      expect(completedValues).to.deep.equal(['Ada']);

      yield [{ name: 'Grace' }, { name: 'Lin' }];
    }

    const schema = schemaWithUserFields({
      friend: batchedField(friendType, resolveFriends),
    });

    const result = await execute({
      schema,
      document: parse('{ users { friend { name } } }'),
      rootValue: { users: [{}, {}, {}] },
    });

    expectJSON(result).toDeepEqual({
      data: {
        users: [
          { friend: { name: 'Ada' } },
          { friend: { name: 'Grace' } },
          { friend: { name: 'Lin' } },
        ],
      },
    });
    expect(completedValues).to.deep.equal(['Ada', 'Grace', 'Lin']);
  });

  it('accepts a promise for an async iterable of result chunks', async () => {
    async function* resolveNames() {
      yield await Promise.resolve(['Ada']);
      yield ['Grace'];
    }

    const schema = schemaWithUserFields({
      name: batchedField(GraphQLString, () => Promise.resolve(resolveNames())),
    });

    const result = await execute({
      schema,
      document: parse('{ users { name } }'),
      rootValue: { users: [{}, {}] },
    });

    expectJSON(result).toDeepEqual({
      data: { users: [{ name: 'Ada' }, { name: 'Grace' }] },
    });
  });

  it('reads the async iterator method and each yielded value once', async () => {
    let methodReads = 0;
    let valueReads = 0;
    let yielded = false;
    const batches = Object.defineProperty({}, Symbol.asyncIterator, {
      get() {
        methodReads++;
        return () => ({
          next: () => {
            if (yielded) {
              return Promise.resolve({ done: true, value: undefined });
            }
            yielded = true;
            return Promise.resolve(
              Object.defineProperty({ done: false }, 'value', {
                get() {
                  valueReads++;
                  return ['Ada', 'Grace'];
                },
              }) as IteratorYieldResult<ReadonlyArray<string>>,
            );
          },
        });
      },
    }) as AsyncIterable<ReadonlyArray<string>>;
    const schema = schemaWithUserFields({
      name: batchedField(GraphQLString, () => batches),
    });

    const result = await execute({
      schema,
      document: parse('{ users { name } }'),
      rootValue: { users: [{}, {}] },
    });

    expectJSON(result).toDeepEqual({
      data: { users: [{ name: 'Ada' }, { name: 'Grace' }] },
    });
    expect(methodReads).to.equal(1);
    expect(valueReads).to.equal(1);
  });

  it('does not allow async iterable batches in executeSync', () => {
    async function* resolveName() {
      yield await Promise.resolve(['Ada']);
    }

    const schema = schemaWithQueryFields({
      name: batchedField(GraphQLString, resolveName),
    });

    expect(() => executeSync({ schema, document: parse('{ name }') })).to.throw(
      'GraphQL execution failed to complete synchronously.',
    );
  });

  it('reports chunk shape, result count, and iterator failures for the group', async () => {
    let tooManyClosed = false;
    const streamError = new Error('batch stream boom');

    async function* nonIterableChunk() {
      yield await Promise.resolve(['Ada']);
      yield null as unknown as ReadonlyArray<unknown>;
    }
    async function* tooFew() {
      yield await Promise.resolve(['Ada']);
    }
    async function* tooMany() {
      try {
        yield await Promise.resolve(['Ada']);
        yield ['Grace', 'Lin'];
      } finally {
        tooManyClosed = true;
      }
    }
    async function* throwsDuringIteration() {
      yield await Promise.resolve(['Ada']);
      throw streamError;
    }

    const schema = schemaWithUserFields(
      {
        nonIterableChunk: batchedField(GraphQLString, nonIterableChunk),
        tooFew: batchedField(GraphQLString, tooFew),
        tooMany: batchedField(GraphQLString, tooMany),
        throwsDuringIteration: batchedField(
          GraphQLString,
          throwsDuringIteration,
        ),
      },
      'AsyncBatchErrorUser',
    );

    const result = await execute({
      schema,
      document: parse(`
        {
          users {
            nonIterableChunk
            tooFew
            tooMany
            throwsDuringIteration
          }
        }
      `),
      rootValue: { users: [{}, {}] },
    });

    expectJSON(result.data).toDeepEqual({
      users: [
        {
          nonIterableChunk: null,
          tooFew: null,
          tooMany: null,
          throwsDuringIteration: null,
        },
        {
          nonIterableChunk: null,
          tooFew: null,
          tooMany: null,
          throwsDuringIteration: null,
        },
      ],
    });
    const expectedMessages = {
      nonIterableChunk:
        'Expected async batch resolver for field "AsyncBatchErrorUser.nonIterableChunk" to yield an Iterable for each result chunk.',
      tooFew:
        'Expected batch resolver for field "AsyncBatchErrorUser.tooFew" to return 2 results, returned 1.',
      tooMany:
        'Expected batch resolver for field "AsyncBatchErrorUser.tooMany" to return 2 results, returned 3.',
      throwsDuringIteration: 'batch stream boom',
    };
    expect(result.errors).to.have.length(8);
    for (const [fieldName, message] of Object.entries(expectedMessages)) {
      expect(
        result.errors
          ?.filter((error) => error.path?.[2] === fieldName)
          .map((error) => ({ message: error.message, path: error.path })),
      ).to.deep.equal([
        { message, path: ['users', 0, fieldName] },
        { message, path: ['users', 1, fieldName] },
      ]);
    }
    expect(tooManyClosed).to.equal(true);
  });

  it('reports an async iterator creation failure for every batch entry', async () => {
    const iteratorError = new Error('iterator creation boom');
    const batches: AsyncIterable<ReadonlyArray<string>> = {
      [Symbol.asyncIterator]() {
        throw iteratorError;
      },
    };
    const schema = schemaWithUserFields({
      name: batchedField(GraphQLString, () => batches),
    });

    const result = await execute({
      schema,
      document: parse('{ users { name } }'),
      rootValue: { users: [{}, {}] },
    });

    expectJSON(result).toDeepEqual({
      data: { users: [{ name: null }, { name: null }] },
      errors: [
        {
          message: 'iterator creation boom',
          path: ['users', 0, 'name'],
          locations: [{ line: 1, column: 11 }],
        },
        {
          message: 'iterator creation boom',
          path: ['users', 1, 'name'],
          locations: [{ line: 1, column: 11 }],
        },
      ],
    });
  });

  it('reports an async iterator getter failure for every batch entry', async () => {
    const iteratorError = new Error('iterator getter boom');
    const batches = Object.defineProperty({}, Symbol.asyncIterator, {
      get() {
        throw iteratorError;
      },
    }) as AsyncIterable<ReadonlyArray<string>>;
    const schema = schemaWithUserFields({
      name: batchedField(GraphQLString, () => batches),
    });

    const result = await execute({
      schema,
      document: parse('{ users { name } }'),
      rootValue: { users: [{}, {}] },
    });

    expectJSON(result).toDeepEqual({
      data: { users: [{ name: null }, { name: null }] },
      errors: [
        {
          message: 'iterator getter boom',
          path: ['users', 0, 'name'],
          locations: [{ line: 1, column: 11 }],
        },
        {
          message: 'iterator getter boom',
          path: ['users', 1, 'name'],
          locations: [{ line: 1, column: 11 }],
        },
      ],
    });
  });

  it('reports a malformed async iterator result for every batch entry', async () => {
    const iterationError = new Error('iteration result boom');
    let closed = false;
    const batches: AsyncIterable<ReadonlyArray<string>> = {
      [Symbol.asyncIterator]() {
        return {
          next: () =>
            Promise.resolve({
              get done(): boolean {
                throw iterationError;
              },
              value: ['unreachable'],
            }),
          return: () => {
            closed = true;
            return Promise.resolve({ done: true, value: undefined });
          },
        };
      },
    };
    const schema = schemaWithUserFields({
      name: batchedField(GraphQLString, () => batches),
    });

    const result = await execute({
      schema,
      document: parse('{ users { name } }'),
      rootValue: { users: [{}, {}] },
    });

    expectJSON(result).toDeepEqual({
      data: { users: [{ name: null }, { name: null }] },
      errors: [
        {
          message: 'iteration result boom',
          path: ['users', 0, 'name'],
          locations: [{ line: 1, column: 11 }],
        },
        {
          message: 'iteration result boom',
          path: ['users', 1, 'name'],
          locations: [{ line: 1, column: 11 }],
        },
      ],
    });
    expect(closed).to.equal(true);
  });

  it('closes the async iterator when completing a chunk aborts the group', async () => {
    let closed = false;
    async function* resolveRequiredName() {
      try {
        yield await Promise.resolve([null]);
        yield ['unreachable'];
      } finally {
        closed = true;
      }
    }

    const schema = schemaWithQueryFields({
      requiredName: batchedField(
        new GraphQLNonNull(GraphQLString),
        resolveRequiredName,
      ),
    });

    const result = await execute({
      schema,
      document: parse('{ requiredName }'),
    });

    expectJSON(result).toDeepEqual({
      data: null,
      errors: [
        {
          message:
            'Cannot return null for non-nullable field Query.requiredName.',
          path: ['requiredName'],
          locations: [{ line: 1, column: 3 }],
        },
      ],
    });
    expect(closed).to.equal(true);
  });

  it('closes the async iterator when execution is aborted between chunks', async () => {
    let closed = false;
    async function* resolveNames() {
      try {
        yield await Promise.resolve(['Ada']);
        executor.abort(new Error('stop batch stream'));
        yield ['Grace'];
      } finally {
        closed = true;
      }
    }

    const schema = schemaWithUserFields({
      name: batchedField(GraphQLString, resolveNames),
    });
    const validatedExecutionArgs = validateExecutionArgs({
      schema,
      document: parse('{ users { name } }'),
      rootValue: { users: [{}, {}] },
      enableBatchResolvers: true,
    });
    assert('schema' in validatedExecutionArgs);
    const executor = new Executor(validatedExecutionArgs);
    const result = executor.executeRootSelectionSet();

    let caughtError: unknown;
    try {
      await result;
    } catch (error) {
      caughtError = error;
    }
    assert(caughtError instanceof AbortedGraphQLExecutionError);
    expect(caughtError.message).to.equal('stop batch stream');
    expectJSON(await caughtError.abortedResult).toDeepEqual({
      data: { users: [{ name: 'Ada' }, { name: null }] },
      errors: [
        {
          message: 'Aborted!',
          path: ['users', 1, 'name'],
          locations: [{ line: 1, column: 11 }],
        },
      ],
    });
    expect(closed).to.equal(true);
  });

  it('closes the async iterator when execution is aborted during a pending next call', async () => {
    let nextStartedResolve!: () => void;
    const nextStarted = new Promise<void>((resolve) => {
      nextStartedResolve = resolve;
    });
    let returnCalls = 0;
    const batches: AsyncIterable<ReadonlyArray<string>> = {
      [Symbol.asyncIterator]() {
        return {
          next: () => {
            nextStartedResolve();
            return new Promise<IteratorResult<ReadonlyArray<string>>>(() => {
              // This deliberately remains pending until cancellation closes
              // the iterator through return().
            });
          },
          return: () => {
            returnCalls++;
            return Promise.resolve({ done: true, value: undefined });
          },
        };
      },
    };
    const schema = schemaWithUserFields({
      name: batchedField(GraphQLString, () => batches),
    });
    const validatedExecutionArgs = validateExecutionArgs({
      schema,
      document: parse('{ users { name } }'),
      rootValue: { users: [{}, {}] },
      enableBatchResolvers: true,
    });
    assert('schema' in validatedExecutionArgs);
    const executor = new Executor(validatedExecutionArgs);
    const result = executor.executeRootSelectionSet();
    assert(result instanceof Promise);

    await nextStarted;
    const abortReason = new Error('stop pending batch stream');
    executor.abort(abortReason);

    let caughtError: unknown;
    try {
      await result;
    } catch (error) {
      caughtError = error;
    }
    assert(caughtError instanceof AbortedGraphQLExecutionError);
    expect(caughtError.cause).to.equal(abortReason);
    expectJSON(await caughtError.abortedResult).toDeepEqual({
      data: { users: [{ name: null }, { name: null }] },
      errors: [
        {
          message: 'Aborted!',
          path: ['users', 0, 'name'],
          locations: [{ line: 1, column: 11 }],
        },
        {
          message: 'Aborted!',
          path: ['users', 1, 'name'],
          locations: [{ line: 1, column: 11 }],
        },
      ],
    });
    expect(returnCalls).to.equal(1);
  });

  it('closes the iterator if a non-cancellable next settles after its signal aborts', async () => {
    let closed = false;
    async function* resolveNames() {
      try {
        yield await Promise.resolve(['Ada', 'Grace']);
      } finally {
        closed = true;
      }
    }

    const schema = schemaWithUserFields({
      name: batchedField(GraphQLString, resolveNames),
    });
    const validatedExecutionArgs = validateExecutionArgs({
      schema,
      document: parse('{ users { name } }'),
      rootValue: { users: [{}, {}] },
      enableBatchResolvers: true,
    });
    assert('schema' in validatedExecutionArgs);
    const executor = new Executor(validatedExecutionArgs);
    const abortedController = new AbortController();
    abortedController.abort();
    let abortSignalReads = 0;
    executor.getAbortSignal = () =>
      abortSignalReads++ === 0 ? undefined : abortedController.signal;

    const result = await executor.executeRootSelectionSet();

    expectJSON(result).toDeepEqual({
      data: { users: [{ name: null }, { name: null }] },
      errors: [
        {
          message: 'Aborted!',
          path: ['users', 0, 'name'],
          locations: [{ line: 1, column: 11 }],
        },
        {
          message: 'Aborted!',
          path: ['users', 1, 'name'],
          locations: [{ line: 1, column: 11 }],
        },
      ],
    });
    expect(closed).to.equal(true);
  });

  it('closes the async iterator when chunk completion aborts execution', async () => {
    let closed = false;
    const friendType = new GraphQLObjectType({
      name: 'AbortingBatchFriend',
      fields: {
        name: {
          type: GraphQLString,
          resolve: (source: any) => {
            executor.abort(new Error('stop batch completion'));
            return source.name;
          },
        },
      },
    });
    async function* resolveFriend() {
      try {
        yield await Promise.resolve([{ name: 'Ada' }]);
        yield [{ name: 'unreachable' }];
      } finally {
        closed = true;
      }
    }

    const schema = schemaWithQueryFields({
      friend: batchedField(friendType, resolveFriend),
    });
    const validatedExecutionArgs = validateExecutionArgs({
      schema,
      document: parse('{ friend { name } }'),
      enableBatchResolvers: true,
    });
    assert('schema' in validatedExecutionArgs);
    const executor = new Executor(validatedExecutionArgs);
    const result = executor.executeRootSelectionSet();

    let caughtError: unknown;
    try {
      await result;
    } catch (error) {
      caughtError = error;
    }
    assert(caughtError instanceof AbortedGraphQLExecutionError);
    await caughtError.abortedResult;
    expect(caughtError.message).to.equal('stop batch completion');
    expect(closed).to.equal(true);
  });
});
