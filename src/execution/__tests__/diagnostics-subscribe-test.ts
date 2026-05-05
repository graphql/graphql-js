import { assert, expect } from 'chai';
import { describe, it } from 'mocha';

import { expectEvents } from '../../__testUtils__/expectEvents.js';
import { expectNoTracingActivity } from '../../__testUtils__/expectNoTracingActivity.js';
import { expectToThrow } from '../../__testUtils__/expectToThrow.js';
import { getTracingChannel } from '../../__testUtils__/getTracingChannel.js';

import { isAsyncIterable } from '../../jsutils/isAsyncIterable.js';

import { parse } from '../../language/parser.js';

import type { GraphQLSchema } from '../../type/schema.js';

import { buildSchema } from '../../utilities/buildASTSchema.js';

import { subscribe } from '../execute.js';

const schema = buildSchema(`
  type Query {
    dummy: String
  }

  type Subscription {
    tick: String
  }
`);

const subscribeChannel = getTracingChannel('graphql:subscribe');
const executeRootSelectionSetChannel = getTracingChannel(
  'graphql:execute:rootSelectionSet',
);

async function* twoTicks(): AsyncIterable<{ tick: string }> {
  await Promise.resolve();
  yield { tick: 'one' };
  yield { tick: 'two' };
}

describe('subscribe diagnostics channel', () => {
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

  it('emits execute root selection set events for each event with the default per-event executor', async () => {
    const document = parse('subscription S($tick: String) { tick }');
    const operation = document.definitions[0];
    const variableValues = { tick: 'ignored by the field' };

    await expectEvents(
      executeRootSelectionSetChannel,
      async () => {
        const subscription = await subscribe({
          schema,
          document,
          rootValue: { tick: twoTicks },
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
        return [firstResult.value, secondResult.value] as const;
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
            result: firstResult,
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
            result: secondResult,
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
      () => expectToThrow(() => subscribe({ schema: invalidSchema, document })),
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
