import { describe, it } from 'node:test';

import { expect } from 'chai';

import { expectEvents } from '../../__testUtils__/expectEvents.ts';
import { expectNoTracingActivity } from '../../__testUtils__/expectNoTracingActivity.ts';
import { expectPromise } from '../../__testUtils__/expectPromise.ts';
import { expectToThrow } from '../../__testUtils__/expectToThrow.ts';
import { getTracingChannel } from '../../__testUtils__/getTracingChannel.ts';
import { resolveOnNextTick } from '../../__testUtils__/resolveOnNextTick.ts';

import type { OperationDefinitionNode } from '../../language/ast.ts';
import { OperationTypeNode } from '../../language/ast.ts';
import { parse } from '../../language/parser.ts';

import { GraphQLObjectType } from '../../type/definition.ts';
import { GraphQLString } from '../../type/scalars.ts';
import { GraphQLSchema } from '../../type/schema.ts';

import { buildSchema } from '../../utilities/buildASTSchema.ts';

import {
  execute,
  executeIgnoringIncremental,
  executeSync,
} from '../execute.ts';

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
            schema,
            document,
            rawVariableValues: variableValues,
            operationName: 'Q',
            operationType: OperationTypeNode.QUERY,
          },
        },
        {
          channel: 'end',
          context: {
            schema,
            document,
            rawVariableValues: variableValues,
            operationName: 'Q',
            operationType: OperationTypeNode.QUERY,
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
            schema,
            document,
            rawVariableValues: undefined,
            operationName: undefined,
            operationType: OperationTypeNode.QUERY,
          },
        },
        {
          channel: 'end',
          context: {
            schema,
            document,
            rawVariableValues: undefined,
            operationName: undefined,
            operationType: OperationTypeNode.QUERY,
          },
        },
        {
          channel: 'asyncStart',
          context: {
            schema,
            document,
            rawVariableValues: undefined,
            operationName: undefined,
            operationType: OperationTypeNode.QUERY,
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
            operationType: OperationTypeNode.QUERY,
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
            schema: asyncDeferSchema,
            document,
            rawVariableValues: undefined,
            operationName: 'Deferred',
            operationType: OperationTypeNode.QUERY,
          },
        },
        {
          channel: 'end',
          context: {
            schema: asyncDeferSchema,
            document,
            rawVariableValues: undefined,
            operationName: 'Deferred',
            operationType: OperationTypeNode.QUERY,
          },
        },
        {
          channel: 'error',
          context: {
            schema: asyncDeferSchema,
            document,
            rawVariableValues: undefined,
            operationName: 'Deferred',
            operationType: OperationTypeNode.QUERY,
            error,
          },
        },
        {
          channel: 'asyncStart',
          context: {
            schema: asyncDeferSchema,
            document,
            rawVariableValues: undefined,
            operationName: 'Deferred',
            operationType: OperationTypeNode.QUERY,
            error,
          },
        },
        {
          channel: 'asyncEnd',
          context: {
            schema: asyncDeferSchema,
            document,
            rawVariableValues: undefined,
            operationName: 'Deferred',
            operationType: OperationTypeNode.QUERY,
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
            schema,
            document,
            rawVariableValues: undefined,
            operationName: undefined,
            operationType: OperationTypeNode.QUERY,
          },
        },
        {
          channel: 'end',
          context: {
            schema,
            document,
            rawVariableValues: undefined,
            operationName: undefined,
            operationType: OperationTypeNode.QUERY,
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
            schema,
            document,
            rawVariableValues: undefined,
            operationName: 'Q',
            operationType: OperationTypeNode.QUERY,
          },
        },
        {
          channel: 'end',
          context: {
            schema,
            document,
            rawVariableValues: undefined,
            operationName: 'Q',
            operationType: OperationTypeNode.QUERY,
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
            schema: invalidSchema,
            document,
            rawVariableValues: undefined,
            operationName: undefined,
            operationType: OperationTypeNode.QUERY,
          },
        },
        {
          channel: 'error',
          context: {
            schema: invalidSchema,
            document,
            rawVariableValues: undefined,
            operationName: undefined,
            operationType: OperationTypeNode.QUERY,
            error,
          },
        },
        {
          channel: 'end',
          context: {
            schema: invalidSchema,
            document,
            rawVariableValues: undefined,
            operationName: undefined,
            operationType: OperationTypeNode.QUERY,
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
    const operation = document.definitions[0] as OperationDefinitionNode;
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
            schema,
            document,
            operation,
            rawVariableValues: variableValues,
            operationName: 'Q',
            operationType: OperationTypeNode.QUERY,
          },
        },
        {
          channel: 'end',
          context: {
            schema,
            document,
            operation,
            rawVariableValues: variableValues,
            operationName: 'Q',
            operationType: OperationTypeNode.QUERY,
            result,
          },
        },
      ],
    );
  });

  it('emits the full async lifecycle when the root selection set returns a promise', async () => {
    const document = parse('query { async }');
    const operation = document.definitions[0] as OperationDefinitionNode;

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
            schema,
            document,
            operation,
            rawVariableValues: undefined,
            operationName: undefined,
            operationType: OperationTypeNode.QUERY,
          },
        },
        {
          channel: 'end',
          context: {
            schema,
            document,
            operation,
            rawVariableValues: undefined,
            operationName: undefined,
            operationType: OperationTypeNode.QUERY,
          },
        },
        {
          channel: 'asyncStart',
          context: {
            schema,
            document,
            operation,
            rawVariableValues: undefined,
            operationName: undefined,
            operationType: OperationTypeNode.QUERY,
            result,
          },
        },
        {
          channel: 'asyncEnd',
          context: {
            schema,
            document,
            operation,
            rawVariableValues: undefined,
            operationName: undefined,
            operationType: OperationTypeNode.QUERY,
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
