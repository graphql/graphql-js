import { describe, it } from 'node:test';

import { expect } from 'chai';

import type { TracingSubChannelRecord } from '../../__testUtils__/diagnosticsTracing.ts';
import { tracingSubChannels } from '../../__testUtils__/diagnosticsTracing.ts';
import { expectEvents } from '../../__testUtils__/expectEvents.ts';
import { expectNoTracingActivity } from '../../__testUtils__/expectNoTracingActivity.ts';
import { getTracingChannel } from '../../__testUtils__/getTracingChannel.ts';

import { parse } from '../../language/parser.ts';

import { GraphQLObjectType } from '../../type/definition.ts';
import { GraphQLString } from '../../type/scalars.ts';
import { GraphQLSchema } from '../../type/schema.ts';

import { buildSchema } from '../../utilities/buildASTSchema.ts';

import type { GraphQLResolveContext } from '../../diagnostics.ts';

import { execute } from '../execute.ts';

const schema = buildSchema(`
  type Query {
    sync: String
    async: String
    fail: String
    asyncFail: String
    plain: String
    nested: Nested
  }

  type Nested {
    leaf: String
  }

  type Mutation {
    first: String
    second: String
  }
`);

const resolveChannel = getTracingChannel('graphql:resolve');

describe('resolve diagnostics channel', () => {
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
            alias: 'sync',
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
            alias: 'sync',
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
            alias: 'async',
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
            alias: 'async',
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
            alias: 'async',
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
            alias: 'async',
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

  it('emits the full async lifecycle when a resolver returns a thenable', async () => {
    const document = parse('{ async }');
    const thenable = {
      then<TResult1 = string, TResult2 = never>(
        onfulfilled?:
          | ((value: string) => TResult1 | PromiseLike<TResult1>)
          | null,
        onrejected?:
          | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
          | null,
      ): PromiseLike<TResult1 | TResult2> {
        return Promise.resolve('hello-thenable').then(onfulfilled, onrejected);
      },
    };

    await expectEvents(
      resolveChannel,
      () =>
        execute({
          schema,
          document,
          rootValue: { async: () => thenable },
        }),
      () => [
        {
          channel: 'start',
          context: {
            fieldName: 'async',
            alias: 'async',
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
            alias: 'async',
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
            alias: 'async',
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
            alias: 'async',
            parentType: 'Query',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'async',
            result: 'hello-thenable',
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
            alias: 'fail',
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
            alias: 'fail',
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
            alias: 'fail',
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
            alias: 'asyncFail',
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
            alias: 'asyncFail',
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
            alias: 'asyncFail',
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
            alias: 'asyncFail',
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
            alias: 'asyncFail',
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
            alias: 'trivial',
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
            alias: 'trivial',
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
            alias: 'custom',
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
            alias: 'custom',
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
            alias: 'nested',
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
            alias: 'nested',
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
            alias: 'leaf',
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
            alias: 'leaf',
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

  it('reports the response key as alias, using it in fieldPath', async () => {
    const document = parse('{ renamed: nested { aliasedLeaf: leaf } }');
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
            alias: 'renamed',
            parentType: 'Query',
            fieldType: 'Nested',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'renamed',
          },
        },
        {
          channel: 'end',
          context: {
            fieldName: 'nested',
            alias: 'renamed',
            parentType: 'Query',
            fieldType: 'Nested',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'renamed',
            result: nested,
          },
        },
        {
          channel: 'start',
          context: {
            fieldName: 'leaf',
            alias: 'aliasedLeaf',
            parentType: 'Nested',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'renamed.aliasedLeaf',
          },
        },
        {
          channel: 'end',
          context: {
            fieldName: 'leaf',
            alias: 'aliasedLeaf',
            parentType: 'Nested',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'renamed.aliasedLeaf',
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
            alias: 'sync',
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
            alias: 'sync',
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
            alias: 'plain',
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
            alias: 'plain',
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
            alias: 'nested',
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
            alias: 'nested',
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
            alias: 'leaf',
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
            alias: 'leaf',
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
            alias: 'first',
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
            alias: 'first',
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
            alias: 'second',
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
            alias: 'second',
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

  it('observes subscribers added before the next async serial mutation field', async () => {
    const document = parse('mutation M { first second }');
    const events: Array<{
      channel: string;
      context: GraphQLResolveContext;
    }> = [];
    const handler = {} as TracingSubChannelRecord<
      (context: GraphQLResolveContext) => void
    >;

    for (const tracingSubChannel of tracingSubChannels) {
      handler[tracingSubChannel] = (context) => {
        events.push({
          channel: tracingSubChannel,
          context: { ...context },
        });
      };
    }

    let subscribed = false;
    try {
      const result = await execute({
        schema,
        document,
        rootValue: {
          first: () => {
            resolveChannel.subscribe(handler);
            subscribed = true;
            return Promise.resolve('one');
          },
          second: () => 'two',
        },
      });

      expect(result).to.deep.equal({ data: { first: 'one', second: 'two' } });
      expect(events).to.deep.equal([
        {
          channel: 'start',
          context: {
            fieldName: 'second',
            alias: 'second',
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
            alias: 'second',
            parentType: 'Mutation',
            fieldType: 'String',
            args: {},
            isDefaultResolver: true,
            fieldPath: 'second',
            result: 'two',
          },
        },
      ]);
    } finally {
      if (subscribed) {
        resolveChannel.unsubscribe(handler);
      }
    }
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
