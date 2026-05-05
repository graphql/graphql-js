import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectEvents } from '../../__testUtils__/expectEvents.js';
import { expectNoTracingActivity } from '../../__testUtils__/expectNoTracingActivity.js';
import { expectPromise } from '../../__testUtils__/expectPromise.js';
import { expectToThrow } from '../../__testUtils__/expectToThrow.js';
import { getTracingChannel } from '../../__testUtils__/getTracingChannel.js';
import { resolveOnNextTick } from '../../__testUtils__/resolveOnNextTick.js';

import { parse } from '../../language/parser.js';

import { GraphQLObjectType } from '../../type/definition.js';
import { GraphQLString } from '../../type/scalars.js';
import { GraphQLSchema } from '../../type/schema.js';

import { buildSchema } from '../../utilities/buildASTSchema.js';

import {
  execute,
  executeIgnoringIncremental,
  executeSync,
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
const executeRootSelectionSetChannel = getTracingChannel(
  'graphql:execute:rootSelectionSet',
);

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
      () => expectToThrow(() => execute({ schema: invalidSchema, document })),
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

describe('execute root selection set diagnostics channel', () => {
  it('emits start and end around a synchronous root selection set', async () => {
    const document = parse('query Q($sync: String) { sync }');
    const operation = document.definitions[0];
    const variableValues = { sync: 'ignored by the field' };

    await expectEvents(
      executeRootSelectionSetChannel,
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
            operation,
            schema,
            variableValues,
            operationName: 'Q',
            operationType: 'query',
          },
        },
        {
          channel: 'end',
          context: {
            operation,
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

  it('emits the full async lifecycle when the root selection set returns a promise', async () => {
    const document = parse('query { async }');
    const operation = document.definitions[0];
    const variableValues = {};

    await expectEvents(
      executeRootSelectionSetChannel,
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
            operation,
            schema,
            variableValues,
            operationName: undefined,
            operationType: 'query',
          },
        },
        {
          channel: 'end',
          context: {
            operation,
            schema,
            variableValues,
            operationName: undefined,
            operationType: 'query',
          },
        },
        {
          channel: 'asyncStart',
          context: {
            operation,
            schema,
            variableValues,
            operationName: undefined,
            operationType: 'query',
          },
        },
        {
          channel: 'asyncEnd',
          context: {
            operation,
            schema,
            variableValues,
            operationName: undefined,
            operationType: 'query',
            result,
          },
        },
      ],
    );
  });

  it('does not call tracing methods when no subscribers are attached', async () => {
    const document = parse('{ sync }');
    const result = await expectNoTracingActivity(
      executeRootSelectionSetChannel,
      () =>
        execute({
          schema,
          document,
          rootValue: { sync: () => 'hello' },
        }),
    );
    expect(result).to.deep.equal({ data: { sync: 'hello' } });
  });
});
