import { describe, it } from 'node:test';

import { expectEvents } from '../../../__testUtils__/expectEvents.ts';
import { expectNoTracingActivity } from '../../../__testUtils__/expectNoTracingActivity.ts';
import { getTracingChannel } from '../../../__testUtils__/getTracingChannel.ts';

import { parse } from '../../../language/parser.ts';

import { GraphQLString } from '../../../type/scalars.ts';

import { execute as executeWithoutBatchResolvers } from '../../execute.ts';

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

const resolveBatchChannel = getTracingChannel('graphql:resolve:batch');
const resolveChannel = getTracingChannel('graphql:resolve');

describe('batch resolve diagnostics channel', () => {
  it('emits start and end around a synchronous batch resolver', async () => {
    const schema = schemaWithUserFields({
      id: { type: GraphQLString },
      name: batchedField(
        GraphQLString,
        (sources, args) =>
          sources.map((source: any) => `${args.prefix}${source.id}`),
        {
          args: {
            prefix: { type: GraphQLString },
          },
        },
      ),
    });

    await expectEvents(
      resolveBatchChannel,
      () =>
        execute({
          schema,
          document: parse('{ users { name(prefix: "user-") } }'),
          rootValue: {
            users: [{ id: '1' }, { id: '2' }],
          },
        }),
      () => [
        {
          channel: 'start',
          context: {
            fieldName: 'name',
            responseKeys: ['name', 'name'],
            parentType: 'User',
            fieldType: 'String',
            args: { prefix: 'user-' },
            batchSize: 2,
            fieldPaths: ['users.0.name', 'users.1.name'],
          },
        },
        {
          channel: 'end',
          context: {
            fieldName: 'name',
            responseKeys: ['name', 'name'],
            parentType: 'User',
            fieldType: 'String',
            args: { prefix: 'user-' },
            batchSize: 2,
            fieldPaths: ['users.0.name', 'users.1.name'],
            result: ['user-1', 'user-2'],
          },
        },
      ],
    );
  });

  it('emits full async lifecycle with error when a batch resolver rejects', async () => {
    const error = new Error('batch boom');
    const schema = schemaWithUserFields({
      name: batchedField(GraphQLString, () => Promise.reject(error)),
    });
    const expectedContext = {
      fieldName: 'name',
      responseKeys: ['name', 'name'],
      parentType: 'User',
      fieldType: 'String',
      args: {},
      batchSize: 2,
      fieldPaths: ['users.0.name', 'users.1.name'],
    };

    await expectEvents(
      resolveBatchChannel,
      () =>
        execute({
          schema,
          document: parse('{ users { name } }'),
          rootValue: {
            users: [{ id: '1' }, { id: '2' }],
          },
        }),
      () => [
        {
          channel: 'start',
          context: expectedContext,
        },
        {
          channel: 'end',
          context: expectedContext,
        },
        {
          channel: 'error',
          context: { ...expectedContext, error },
        },
        {
          channel: 'asyncStart',
          context: { ...expectedContext, error },
        },
        {
          channel: 'asyncEnd',
          context: { ...expectedContext, error },
        },
      ],
    );
  });

  it('does not emit batch resolvers on the single-field resolve channel', async () => {
    const schema = schemaWithQueryFields({
      name: batchedField(GraphQLString, () => ['Ada']),
    });

    await expectNoTracingActivity(resolveChannel, () =>
      execute({
        schema,
        document: parse('{ name }'),
      }),
    );
  });
});
