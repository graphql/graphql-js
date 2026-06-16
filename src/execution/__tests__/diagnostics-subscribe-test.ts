import { describe, it } from 'node:test';

import { assert, expect } from 'chai';

import { expectEvents } from '../../__testUtils__/expectEvents.ts';
import { expectNoTracingActivity } from '../../__testUtils__/expectNoTracingActivity.ts';
import { expectToThrow } from '../../__testUtils__/expectToThrow.ts';
import { getTracingChannel } from '../../__testUtils__/getTracingChannel.ts';

import { isAsyncIterable } from '../../jsutils/isAsyncIterable.ts';

import type { OperationDefinitionNode } from '../../language/ast.ts';
import { OperationTypeNode } from '../../language/ast.ts';
import { parse } from '../../language/parser.ts';

import type { GraphQLSchema } from '../../type/schema.ts';

import { buildSchema } from '../../utilities/buildASTSchema.ts';

import {
  createSourceEventStream,
  executeSubscriptionEvent,
  mapSourceToResponseEvent,
  subscribe,
  validateSubscriptionArgs,
} from '../execute.ts';

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
            schema,
            document,
            rawVariableValues: variableValues,
            operationName: 'S',
            operationType: OperationTypeNode.SUBSCRIPTION,
          },
        },
        {
          channel: 'end',
          context: {
            schema,
            document,
            rawVariableValues: variableValues,
            operationName: 'S',
            operationType: OperationTypeNode.SUBSCRIPTION,
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
            schema,
            document,
            rawVariableValues: undefined,
            operationName: undefined,
            operationType: OperationTypeNode.SUBSCRIPTION,
          },
        },
        {
          channel: 'end',
          context: {
            schema,
            document,
            rawVariableValues: undefined,
            operationName: undefined,
            operationType: OperationTypeNode.SUBSCRIPTION,
          },
        },
        {
          channel: 'asyncStart',
          context: {
            schema,
            document,
            rawVariableValues: undefined,
            operationName: undefined,
            operationType: OperationTypeNode.SUBSCRIPTION,
            result,
          },
        },
        {
          channel: 'asyncEnd',
          context: {
            schema,
            document,
            rawVariableValues: undefined,
            operationName: undefined,
            operationType: OperationTypeNode.SUBSCRIPTION,
            result,
          },
        },
      ],
    );
  });

  it('emits execute root selection set events for each event with the default per-event executor', async () => {
    const document = parse('subscription S($tick: String) { tick }');
    const operation = document.definitions[0] as OperationDefinitionNode;
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
        assert(!firstResult.done, 'Expected first subscription event.');
        const secondResult = await subscription.next();
        expect(secondResult).to.deep.equal({
          done: false,
          value: { data: { tick: 'two' } },
        });
        assert(!secondResult.done, 'Expected second subscription event.');

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
            schema,
            document,
            operation,
            rawVariableValues: variableValues,
            operationName: 'S',
            operationType: OperationTypeNode.SUBSCRIPTION,
          },
        },
        {
          channel: 'end',
          context: {
            schema,
            document,
            operation,
            rawVariableValues: variableValues,
            operationName: 'S',
            operationType: OperationTypeNode.SUBSCRIPTION,
            result: firstResult,
          },
        },
        {
          channel: 'start',
          context: {
            schema,
            document,
            operation,
            rawVariableValues: variableValues,
            operationName: 'S',
            operationType: OperationTypeNode.SUBSCRIPTION,
          },
        },
        {
          channel: 'end',
          context: {
            schema,
            document,
            operation,
            rawVariableValues: variableValues,
            operationName: 'S',
            operationType: OperationTypeNode.SUBSCRIPTION,
            result: secondResult,
          },
        },
      ],
    );
  });

  it('emits execute root selection set events for each event with a custom per-event executor', async () => {
    const document = parse('subscription S($tick: String) { tick }');
    const operation = document.definitions[0] as OperationDefinitionNode;
    const variableValues = { tick: 'ignored by the field' };

    await expectEvents(
      executeRootSelectionSetChannel,
      async () => {
        const validatedArgs = validateSubscriptionArgs({
          schema,
          document,
          rootValue: { tick: twoTicks },
          variableValues,
        });
        if (!('schema' in validatedArgs)) {
          throw new Error('Unexpected validation errors');
        }

        const sourceEventStream = await createSourceEventStream(validatedArgs);
        assert(isAsyncIterable(sourceEventStream));

        const customExecutor: typeof executeSubscriptionEvent = (args) =>
          executeSubscriptionEvent(args);

        const responseStream = mapSourceToResponseEvent(
          validatedArgs,
          sourceEventStream,
          customExecutor,
        );

        const firstResult = await responseStream.next();
        expect(firstResult).to.deep.equal({
          done: false,
          value: { data: { tick: 'one' } },
        });
        assert(!firstResult.done, 'Expected first subscription event.');
        const secondResult = await responseStream.next();
        expect(secondResult).to.deep.equal({
          done: false,
          value: { data: { tick: 'two' } },
        });
        assert(!secondResult.done, 'Expected second subscription event.');

        const returned = responseStream.return?.();
        if (returned !== undefined) {
          await returned;
        }
        return [firstResult.value, secondResult.value] as const;
      },
      ([firstResult, secondResult]) => [
        {
          channel: 'start',
          context: {
            schema,
            document,
            operation,
            rawVariableValues: variableValues,
            operationName: 'S',
            operationType: OperationTypeNode.SUBSCRIPTION,
          },
        },
        {
          channel: 'end',
          context: {
            schema,
            document,
            operation,
            rawVariableValues: variableValues,
            operationName: 'S',
            operationType: OperationTypeNode.SUBSCRIPTION,
            result: firstResult,
          },
        },
        {
          channel: 'start',
          context: {
            schema,
            document,
            operation,
            rawVariableValues: variableValues,
            operationName: 'S',
            operationType: OperationTypeNode.SUBSCRIPTION,
          },
        },
        {
          channel: 'end',
          context: {
            schema,
            document,
            operation,
            rawVariableValues: variableValues,
            operationName: 'S',
            operationType: OperationTypeNode.SUBSCRIPTION,
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
            schema,
            document,
            rawVariableValues: undefined,
            operationName: undefined,
            operationType: undefined,
          },
        },
        {
          channel: 'end',
          context: {
            schema,
            document,
            rawVariableValues: undefined,
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
            schema: invalidSchema,
            document,
            rawVariableValues: undefined,
            operationName: 'S',
            operationType: OperationTypeNode.SUBSCRIPTION,
          },
        },
        {
          channel: 'error',
          context: {
            schema: invalidSchema,
            document,
            rawVariableValues: undefined,
            operationName: 'S',
            operationType: OperationTypeNode.SUBSCRIPTION,
            error,
          },
        },
        {
          channel: 'end',
          context: {
            schema: invalidSchema,
            document,
            rawVariableValues: undefined,
            operationName: 'S',
            operationType: OperationTypeNode.SUBSCRIPTION,
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
            schema,
            document,
            rawVariableValues: undefined,
            operationName: 'S',
            operationType: OperationTypeNode.SUBSCRIPTION,
          },
        },
        {
          channel: 'end',
          context: {
            schema,
            document,
            rawVariableValues: undefined,
            operationName: 'S',
            operationType: OperationTypeNode.SUBSCRIPTION,
          },
        },
        {
          channel: 'asyncStart',
          context: {
            schema,
            document,
            rawVariableValues: undefined,
            operationName: 'S',
            operationType: OperationTypeNode.SUBSCRIPTION,
            result,
          },
        },
        {
          channel: 'asyncEnd',
          context: {
            schema,
            document,
            rawVariableValues: undefined,
            operationName: 'S',
            operationType: OperationTypeNode.SUBSCRIPTION,
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
