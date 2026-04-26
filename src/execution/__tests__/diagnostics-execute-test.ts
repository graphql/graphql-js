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
  }

  type Subscription {
    tick: String
  }
`);

const executeChannel = getTracingChannel('graphql:execute');

describe('execute diagnostics channel', () => {
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

      type Query {
        sync: String
      }
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
