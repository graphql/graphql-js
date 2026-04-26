import { assert, expect } from 'chai';
import { describe, it } from 'mocha';

import { catchThrownError } from '../../__testUtils__/catchThrownError.js';
import { expectEvents } from '../../__testUtils__/expectEvents.js';
import { expectNoTracingActivity } from '../../__testUtils__/expectNoTracingActivity.js';
import { expectPromise } from '../../__testUtils__/expectPromise.js';
import { getTracingChannel } from '../../__testUtils__/getTracingChannel.js';
import { resolveOnNextTick } from '../../__testUtils__/resolveOnNextTick.js';

import { isAsyncIterable } from '../../jsutils/isAsyncIterable.js';

import { parse } from '../../language/parser.js';

import { GraphQLObjectType } from '../../type/definition.js';
import { GraphQLString } from '../../type/scalars.js';
import { GraphQLSchema } from '../../type/schema.js';

import { buildSchema } from '../../utilities/buildASTSchema.js';

import {
  execute,
  executeIgnoringIncremental,
  executeSync,
  subscribe,
} from '../execute.js';

const schema = buildSchema(`
  type Query {
    sync: String
    async: String
    fail: String
    asyncFail: String
    plain: String
    nested: Nested
    dummy: String
  }

  type Nested {
    leaf: String
  }

  type Mutation {
    first: String
    second: String
  }

  type Subscription {
    tick: String
  }
`);

describe('execute diagnostics channel', () => {
  const executeChannel = getTracingChannel('graphql:execute');

  it('emits start and end around a synchronous execute', async () => {
    const document = parse('query Q($sync: String) { sync }');
    const variableValues = { sync: 'ignored by the field' };

    await expectEvents(
      executeChannel,
      () =>
        execute({
          schema,
          document,
          rootValue: { sync: () => 'hello' },
          variableValues,
        }),
      (result) => [
        {
          channel: 'start',
          context: {
            document,
            schema,
            variableValues,
            operationName: 'Q',
            operationType: 'query',
          },
        },
        {
          channel: 'end',
          context: {
            document,
            schema,
            variableValues,
            operationName: 'Q',
            operationType: 'query',
            result,
          },
        },
      ],
    );
  });

  it('emits start, end, and async lifecycle when execute returns a promise', async () => {
    const document = parse('query { async }');

    await expectEvents(
      executeChannel,
      () =>
        execute({
          schema,
          document,
          rootValue: { async: () => Promise.resolve('hello-async') },
        }),
      (result) => [
        {
          channel: 'start',
          context: {
            document,
            schema,
            variableValues: undefined,
            operationName: undefined,
            operationType: 'query',
          },
        },
        {
          channel: 'end',
          context: {
            document,
            schema,
            variableValues: undefined,
            operationName: undefined,
            operationType: 'query',
          },
        },
        {
          channel: 'asyncStart',
          context: {
            document,
            schema,
            variableValues: undefined,
            operationName: undefined,
            operationType: 'query',
          },
        },
        {
          channel: 'asyncEnd',
          context: {
            document,
            schema,
            variableValues: undefined,
            operationName: undefined,
            operationType: 'query',
            result,
          },
        },
      ],
    );
  });

  it('emits full async lifecycle with error when execute returns a rejected promise', async () => {
    const asyncDeferSchema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          hero: {
            type: new GraphQLObjectType({
              name: 'Hero',
              fields: {
                id: { type: GraphQLString },
                name: { type: GraphQLString },
              },
            }),
          },
        },
      }),
    });
    const document = parse(`
      query Deferred {
        hero { name ... @defer { id } }
      }
    `);

    await expectEvents(
      executeChannel,
      () =>
        expectPromise(
          execute({
            schema: asyncDeferSchema,
            document,
            rootValue: {
              hero: Promise.resolve({
                id: '1',
                name: async () => {
                  await resolveOnNextTick();
                  return 'slow';
                },
              }),
            },
          }),
        ).toReject(),
      (error) => [
        {
          channel: 'start',
          context: {
            document,
            schema: asyncDeferSchema,
            variableValues: undefined,
            operationName: 'Deferred',
            operationType: 'query',
          },
        },
        {
          channel: 'end',
          context: {
            document,
            schema: asyncDeferSchema,
            variableValues: undefined,
            operationName: 'Deferred',
            operationType: 'query',
          },
        },
        {
          channel: 'asyncStart',
          context: {
            document,
            schema: asyncDeferSchema,
            variableValues: undefined,
            operationName: 'Deferred',
            operationType: 'query',
          },
        },
        {
          channel: 'error',
          context: {
            document,
            schema: asyncDeferSchema,
            variableValues: undefined,
            operationName: 'Deferred',
            operationType: 'query',
            error,
          },
        },
        {
          channel: 'asyncEnd',
          context: {
            document,
            schema: asyncDeferSchema,
            variableValues: undefined,
            operationName: 'Deferred',
            operationType: 'query',
            error,
          },
        },
      ],
    );
  });

  it('emits once for executeSync via experimentalExecuteIncrementally', async () => {
    const document = parse('{ sync }');

    await expectEvents(
      executeChannel,
      () =>
        executeSync({ schema, document, rootValue: { sync: () => 'hello' } }),
      (result) => [
        {
          channel: 'start',
          context: {
            document,
            schema,
            variableValues: undefined,
            operationName: undefined,
            operationType: 'query',
          },
        },
        {
          channel: 'end',
          context: {
            document,
            schema,
            variableValues: undefined,
            operationName: undefined,
            operationType: 'query',
            result,
          },
        },
      ],
    );
  });

  it('emits start and end around executeIgnoringIncremental', async () => {
    const document = parse('query Q { sync }');

    await expectEvents(
      executeChannel,
      () =>
        executeIgnoringIncremental({
          schema,
          document,
          rootValue: { sync: () => 'hello' },
        }),
      (result) => [
        {
          channel: 'start',
          context: {
            document,
            schema,
            variableValues: undefined,
            operationName: 'Q',
            operationType: 'query',
          },
        },
        {
          channel: 'end',
          context: {
            document,
            schema,
            variableValues: undefined,
            operationName: 'Q',
            operationType: 'query',
            result,
          },
        },
      ],
    );
  });

  it('emits start, error, and end when execute throws synchronously', async () => {
    const document = parse('{ sync }');
    const invalidSchema = buildSchema(`
        directive @defer on FIELD
        type Query { sync: String }
      `);

    await expectEvents(
      executeChannel,
      () =>
        catchThrownError(() => execute({ schema: invalidSchema, document })),
      (error) => [
        {
          channel: 'start',
          context: {
            document,
            schema: invalidSchema,
            variableValues: undefined,
            operationName: undefined,
            operationType: 'query',
          },
        },
        {
          channel: 'error',
          context: {
            document,
            schema: invalidSchema,
            variableValues: undefined,
            operationName: undefined,
            operationType: 'query',
            error,
          },
        },
        {
          channel: 'end',
          context: {
            document,
            schema: invalidSchema,
            variableValues: undefined,
            operationName: undefined,
            operationType: 'query',
            error,
          },
        },
      ],
    );
  });

  it('emits for each subscription event with resolved operation ctx', async () => {
    async function* tickGenerator() {
      await Promise.resolve();
      yield { tick: 'one' };
      yield { tick: 'two' };
    }

    const document = parse('subscription S($tick: String) { tick }');
    const operation = document.definitions[0];
    const variableValues = { tick: 'ignored by the field' };

    await expectEvents(
      executeChannel,
      async () => {
        const subscription = await subscribe({
          schema,
          document,
          rootValue: { tick: tickGenerator },
          variableValues,
        });
        assert(isAsyncIterable(subscription));

        const firstResult = await subscription.next();
        expect(firstResult).to.deep.equal({
          done: false,
          value: { data: { tick: 'one' } },
        });
        const secondResult = await subscription.next();
        expect(secondResult).to.deep.equal({
          done: false,
          value: { data: { tick: 'two' } },
        });
        const returned = subscription.return?.();
        if (returned !== undefined) {
          await returned;
        }
        return [firstResult, secondResult] as const;
      },
      ([firstResult, secondResult]) => [
        {
          channel: 'start',
          context: {
            operation,
            schema,
            variableValues,
            operationName: 'S',
            operationType: 'subscription',
          },
        },
        {
          channel: 'end',
          context: {
            operation,
            schema,
            variableValues,
            operationName: 'S',
            operationType: 'subscription',
            result: firstResult.value,
          },
        },
        {
          channel: 'start',
          context: {
            operation,
            schema,
            variableValues,
            operationName: 'S',
            operationType: 'subscription',
          },
        },
        {
          channel: 'end',
          context: {
            operation,
            schema,
            variableValues,
            operationName: 'S',
            operationType: 'subscription',
            result: secondResult.value,
          },
        },
      ],
    );
  });

  it('does not call tracing methods when no subscribers are attached', async () => {
    const document = parse('{ sync }');
    const result = await expectNoTracingActivity(executeChannel, () =>
      execute({
        schema,
        document,
        rootValue: { sync: () => 'hello' },
      }),
    );
    expect(result).to.deep.equal({ data: { sync: 'hello' } });
  });
});

describe('subscribe diagnostics channel', () => {
  const subscribeChannel = getTracingChannel('graphql:subscribe');

  async function* twoTicks(): AsyncIterable<{ tick: string }> {
    await Promise.resolve();
    yield { tick: 'one' };
    yield { tick: 'two' };
  }

  it('emits start and end for a synchronous subscription setup', async () => {
    const document = parse('subscription S($tick: String) { tick }');
    const variableValues = { tick: 'ignored by the field' };

    await expectEvents(
      subscribeChannel,
      async () => {
        const subscription = await subscribe({
          schema,
          document,
          rootValue: { tick: twoTicks },
          variableValues,
        });
        assert(isAsyncIterable(subscription));

        const returned = subscription.return?.();
        if (returned !== undefined) {
          await returned;
        }
        return subscription;
      },
      (result) => [
        {
          channel: 'start',
          context: {
            document,
            schema,
            variableValues,
            operationName: 'S',
            operationType: 'subscription',
          },
        },
        {
          channel: 'end',
          context: {
            document,
            schema,
            variableValues,
            operationName: 'S',
            operationType: 'subscription',
            result,
          },
        },
      ],
    );
  });

  it('emits the full async lifecycle when subscribe resolver returns a promise', async () => {
    const document = parse('subscription { tick }');

    await expectEvents(
      subscribeChannel,
      async () => {
        const subscription = await subscribe({
          schema,
          document,
          rootValue: {
            tick: (): Promise<AsyncIterable<{ tick: string }>> =>
              Promise.resolve(twoTicks()),
          },
        });
        assert(isAsyncIterable(subscription));

        const returned = subscription.return?.();
        if (returned !== undefined) {
          await returned;
        }
        return subscription;
      },
      (result) => [
        {
          channel: 'start',
          context: {
            document,
            schema,
            variableValues: undefined,
            operationName: undefined,
            operationType: 'subscription',
          },
        },
        {
          channel: 'end',
          context: {
            document,
            schema,
            variableValues: undefined,
            operationName: undefined,
            operationType: 'subscription',
          },
        },
        {
          channel: 'asyncStart',
          context: {
            document,
            schema,
            variableValues: undefined,
            operationName: undefined,
            operationType: 'subscription',
          },
        },
        {
          channel: 'asyncEnd',
          context: {
            document,
            schema,
            variableValues: undefined,
            operationName: undefined,
            operationType: 'subscription',
            result,
          },
        },
      ],
    );
  });

  it('emits only start and end for a synchronous validation failure', async () => {
    const document = parse('fragment F on Subscription { tick }');

    await expectEvents(
      subscribeChannel,
      async () => {
        const result = await subscribe({ schema, document });
        expect(result).to.have.property('errors');
        return result;
      },
      (result) => [
        {
          channel: 'start',
          context: {
            document,
            schema,
            variableValues: undefined,
            operationName: undefined,
            operationType: undefined,
          },
        },
        {
          channel: 'end',
          context: {
            document,
            schema,
            variableValues: undefined,
            operationName: undefined,
            operationType: undefined,
            result,
          },
        },
      ],
    );
  });

  it('emits start, error, and end when subscribe throws synchronously', async () => {
    const document = parse('subscription S { tick }');
    const invalidSchema = {} as GraphQLSchema;

    await expectEvents(
      subscribeChannel,
      () =>
        catchThrownError(() => subscribe({ schema: invalidSchema, document })),
      (error) => [
        {
          channel: 'start',
          context: {
            document,
            schema: invalidSchema,
            variableValues: undefined,
            operationName: 'S',
            operationType: 'subscription',
          },
        },
        {
          channel: 'error',
          context: {
            document,
            schema: invalidSchema,
            variableValues: undefined,
            operationName: 'S',
            operationType: 'subscription',
            error,
          },
        },
        {
          channel: 'end',
          context: {
            document,
            schema: invalidSchema,
            variableValues: undefined,
            operationName: 'S',
            operationType: 'subscription',
            error,
          },
        },
      ],
    );
  });

  it('emits full async lifecycle when subscribe resolver rejects and subscribe resolves to an error result', async () => {
    const document = parse('subscription S { tick }');
    const error = new Error('subscribe-boom');

    await expectEvents(
      subscribeChannel,
      async () => {
        const result = await subscribe({
          schema,
          document,
          rootValue: {
            tick: () => Promise.reject(error),
          },
        });
        expect(result).to.have.property('errors');
        return result;
      },
      (result) => [
        {
          channel: 'start',
          context: {
            document,
            schema,
            variableValues: undefined,
            operationName: 'S',
            operationType: 'subscription',
          },
        },
        {
          channel: 'end',
          context: {
            document,
            schema,
            variableValues: undefined,
            operationName: 'S',
            operationType: 'subscription',
          },
        },
        {
          channel: 'asyncStart',
          context: {
            document,
            schema,
            variableValues: undefined,
            operationName: 'S',
            operationType: 'subscription',
          },
        },
        {
          channel: 'asyncEnd',
          context: {
            document,
            schema,
            variableValues: undefined,
            operationName: 'S',
            operationType: 'subscription',
            result,
          },
        },
      ],
    );
  });

  it('does not call tracing methods when no subscribers are attached', async () => {
    const document = parse('subscription { tick }');

    await expectNoTracingActivity(subscribeChannel, async () => {
      const resolved = await subscribe({
        schema,
        document,
        rootValue: { tick: twoTicks },
      });
      assert(isAsyncIterable(resolved));

      const returned = resolved.return?.();
      if (returned !== undefined) {
        await returned;
      }
    });
  });
});

describe('resolve diagnostics channel', () => {
  const resolveChannel = getTracingChannel('graphql:resolve');

  it('emits start and end around a synchronous resolver', async () => {
    const document = parse('{ sync }');

    await expectEvents(
      resolveChannel,
      () =>
        execute({
          schema,
          document,
          rootValue: { sync: () => 'hello' },
        }),
      () => [
        {
          channel: 'start',
          context: {
            fieldName: 'sync',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'sync',
          },
        },
        {
          channel: 'end',
          context: {
            fieldName: 'sync',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'sync',
            result: 'hello',
          },
        },
      ],
    );
  });

  it('emits the full async lifecycle when a resolver returns a promise', async () => {
    const document = parse('{ async }');

    await expectEvents(
      resolveChannel,
      () =>
        execute({
          schema,
          document,
          rootValue: { async: () => Promise.resolve('hello-async') },
        }),
      () => [
        {
          channel: 'start',
          context: {
            fieldName: 'async',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'async',
          },
        },
        {
          channel: 'end',
          context: {
            fieldName: 'async',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'async',
          },
        },
        {
          channel: 'asyncStart',
          context: {
            fieldName: 'async',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'async',
          },
        },
        {
          channel: 'asyncEnd',
          context: {
            fieldName: 'async',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'async',
            result: 'hello-async',
          },
        },
      ],
    );
  });

  it('emits start, error, end when a sync resolver throws', async () => {
    const document = parse('{ fail }');
    const error = new Error('boom');

    await expectEvents(
      resolveChannel,
      () =>
        execute({
          schema,
          document,
          rootValue: {
            fail: () => {
              throw error;
            },
          },
        }),
      () => [
        {
          channel: 'start',
          context: {
            fieldName: 'fail',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'fail',
          },
        },
        {
          channel: 'error',
          context: {
            fieldName: 'fail',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'fail',
            error,
          },
        },
        {
          channel: 'end',
          context: {
            fieldName: 'fail',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'fail',
            error,
          },
        },
      ],
    );
  });

  it('emits full async lifecycle with error when a resolver rejects', async () => {
    const document = parse('{ asyncFail }');
    const error = new Error('async-boom');

    await expectEvents(
      resolveChannel,
      () =>
        execute({
          schema,
          document,
          rootValue: {
            asyncFail: () => Promise.reject(error),
          },
        }),
      () => [
        {
          channel: 'start',
          context: {
            fieldName: 'asyncFail',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'asyncFail',
          },
        },
        {
          channel: 'end',
          context: {
            fieldName: 'asyncFail',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'asyncFail',
          },
        },
        {
          channel: 'asyncStart',
          context: {
            fieldName: 'asyncFail',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'asyncFail',
          },
        },
        {
          channel: 'error',
          context: {
            fieldName: 'asyncFail',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'asyncFail',
            error,
          },
        },
        {
          channel: 'asyncEnd',
          context: {
            fieldName: 'asyncFail',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'asyncFail',
            error,
          },
        },
      ],
    );
  });

  it('reports isDefaultResolver based on field.resolve presence', async () => {
    const trivialSchema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          trivial: { type: GraphQLString },
          custom: {
            type: GraphQLString,
            resolve: () => 'explicit',
          },
        },
      }),
    });

    await expectEvents(
      resolveChannel,
      () =>
        execute({
          schema: trivialSchema,
          document: parse('{ trivial custom }'),
          rootValue: { trivial: 'value' },
        }),
      () => [
        {
          channel: 'start',
          context: {
            fieldName: 'trivial',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'trivial',
          },
        },
        {
          channel: 'end',
          context: {
            fieldName: 'trivial',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'trivial',
            result: 'value',
          },
        },
        {
          channel: 'start',
          context: {
            fieldName: 'custom',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: false,
            fieldPath: 'custom',
          },
        },
        {
          channel: 'end',
          context: {
            fieldName: 'custom',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: false,
            fieldPath: 'custom',
            result: 'explicit',
          },
        },
      ],
    );
  });

  it('serializes fieldPath lazily, joining path keys with dots', async () => {
    const document = parse('{ nested { leaf } }');
    const nested = { leaf: 'leaf-value' };

    await expectEvents(
      resolveChannel,
      () =>
        execute({
          schema,
          document,
          rootValue: {
            nested,
          },
        }),
      () => [
        {
          channel: 'start',
          context: {
            fieldName: 'nested',
            parentType: 'Query',
            fieldType: 'Nested',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'nested',
          },
        },
        {
          channel: 'end',
          context: {
            fieldName: 'nested',
            parentType: 'Query',
            fieldType: 'Nested',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'nested',
            result: nested,
          },
        },
        {
          channel: 'start',
          context: {
            fieldName: 'leaf',
            parentType: 'Nested',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'nested.leaf',
          },
        },
        {
          channel: 'end',
          context: {
            fieldName: 'leaf',
            parentType: 'Nested',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'nested.leaf',
            result: 'leaf-value',
          },
        },
      ],
    );
  });

  it('fires once per field, not per schema walk', async () => {
    const document = parse('{ sync plain nested { leaf } }');
    const nested = { leaf: 'leaf-value' };

    await expectEvents(
      resolveChannel,
      () =>
        execute({
          schema,
          document,
          rootValue: {
            sync: () => 'hello',
            plain: 'plain-value',
            nested,
          },
        }),
      () => [
        {
          channel: 'start',
          context: {
            fieldName: 'sync',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'sync',
          },
        },
        {
          channel: 'end',
          context: {
            fieldName: 'sync',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'sync',
            result: 'hello',
          },
        },
        {
          channel: 'start',
          context: {
            fieldName: 'plain',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'plain',
          },
        },
        {
          channel: 'end',
          context: {
            fieldName: 'plain',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'plain',
            result: 'plain-value',
          },
        },
        {
          channel: 'start',
          context: {
            fieldName: 'nested',
            parentType: 'Query',
            fieldType: 'Nested',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'nested',
          },
        },
        {
          channel: 'end',
          context: {
            fieldName: 'nested',
            parentType: 'Query',
            fieldType: 'Nested',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'nested',
            result: nested,
          },
        },
        {
          channel: 'start',
          context: {
            fieldName: 'leaf',
            parentType: 'Nested',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'nested.leaf',
          },
        },
        {
          channel: 'end',
          context: {
            fieldName: 'leaf',
            parentType: 'Nested',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'nested.leaf',
            result: 'leaf-value',
          },
        },
      ],
    );
  });

  it('emits per-field for serial mutation execution', async () => {
    const document = parse('mutation M { first second }');

    await expectEvents(
      resolveChannel,
      () =>
        execute({
          schema,
          document,
          rootValue: {
            first: () => 'one',
            second: () => 'two',
          },
        }),
      () => [
        {
          channel: 'start',
          context: {
            fieldName: 'first',
            parentType: 'Mutation',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'first',
          },
        },
        {
          channel: 'end',
          context: {
            fieldName: 'first',
            parentType: 'Mutation',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'first',
            result: 'one',
          },
        },
        {
          channel: 'start',
          context: {
            fieldName: 'second',
            parentType: 'Mutation',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'second',
          },
        },
        {
          channel: 'end',
          context: {
            fieldName: 'second',
            parentType: 'Mutation',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'second',
            result: 'two',
          },
        },
      ],
    );
  });

  it('does not call tracing methods when no subscribers are attached', async () => {
    const result = await expectNoTracingActivity(resolveChannel, () =>
      execute({
        schema,
        document: parse('{ sync }'),
        rootValue: { sync: () => 'hello' },
      }),
    );
    expect(result).to.deep.equal({ data: { sync: 'hello' } });
  });
});
