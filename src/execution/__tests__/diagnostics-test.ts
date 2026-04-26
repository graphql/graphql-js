import { assert, expect } from 'chai';
import { afterEach, describe, it } from 'mocha';

import {
  collectEvents,
  expectNoTracingActivity,
  getTracingChannel,
} from '../../__testUtils__/diagnosticsTestUtils.js';

import { isAsyncIterable } from '../../jsutils/isAsyncIterable.js';
import { isPromise } from '../../jsutils/isPromise.js';

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
  let active: ReturnType<typeof collectEvents> | undefined;
  const executeChannel = getTracingChannel('graphql:execute');

  afterEach(() => {
    active?.unsubscribe();
    active = undefined;
  });

  it('emits start and end around a synchronous execute', () => {
    active = collectEvents(executeChannel);

    const document = parse('query Q { sync }');
    const result = execute({
      schema,
      document,
      rootValue: { sync: () => 'hello' },
    });

    expect(result).to.deep.equal({ data: { sync: 'hello' } });
    expect(active.events.map((e) => e.kind)).to.deep.equal(['start', 'end']);
    expect(active.events[0].ctx.operationType).to.equal('query');
    expect(active.events[0].ctx.operationName).to.equal('Q');
    expect(active.events[0].ctx.document).to.equal(document);
    expect(active.events[0].ctx.schema).to.equal(schema);
  });

  it('emits start, end, and async lifecycle when execute returns a promise', async () => {
    active = collectEvents(executeChannel);

    const document = parse('query { async }');
    const result = await execute({
      schema,
      document,
      rootValue: { async: () => Promise.resolve('hello-async') },
    });

    expect(result).to.deep.equal({ data: { async: 'hello-async' } });
    expect(active.events.map((e) => e.kind)).to.deep.equal([
      'start',
      'end',
      'asyncStart',
      'asyncEnd',
    ]);
  });

  it('emits once for executeSync via experimentalExecuteIncrementally', () => {
    active = collectEvents(executeChannel);

    const document = parse('{ sync }');
    executeSync({ schema, document, rootValue: { sync: () => 'hello' } });

    expect(active.events.map((e) => e.kind)).to.deep.equal(['start', 'end']);
  });

  it('emits start and end around executeIgnoringIncremental', () => {
    active = collectEvents(executeChannel);

    const document = parse('query Q { sync }');
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    executeIgnoringIncremental({
      schema,
      document,
      rootValue: { sync: () => 'hello' },
    });

    expect(active.events.map((e) => e.kind)).to.deep.equal(['start', 'end']);
    expect(active.events[0].ctx.operationName).to.equal('Q');
  });

  it('emits start, error, and end when execute throws synchronously', () => {
    active = collectEvents(executeChannel);

    const schemaWithDefer = buildSchema(`
      directive @defer on FIELD
      type Query { sync: String }
    `);
    const document = parse('{ sync }');
    expect(() => execute({ schema: schemaWithDefer, document })).to.throw();

    expect(active.events.map((e) => e.kind)).to.deep.equal([
      'start',
      'error',
      'end',
    ]);
  });

  it('emits for each subscription event with resolved operation ctx', async () => {
    async function* tickGenerator() {
      await Promise.resolve();
      yield { tick: 'one' };
      yield { tick: 'two' };
    }

    const document = parse('subscription S { tick }');

    active = collectEvents(executeChannel);

    const subscription = await subscribe({
      schema,
      document,
      rootValue: { tick: tickGenerator },
    });
    assert(isAsyncIterable(subscription));

    expect(await subscription.next()).to.deep.equal({
      done: false,
      value: { data: { tick: 'one' } },
    });
    expect(await subscription.next()).to.deep.equal({
      done: false,
      value: { data: { tick: 'two' } },
    });

    const starts = active.events.filter((e) => e.kind === 'start');
    expect(starts.length).to.equal(2);
    for (const ev of starts) {
      expect(ev.ctx.operationType).to.equal('subscription');
      expect(ev.ctx.operationName).to.equal('S');
      expect(ev.ctx.operation).to.equal(document.definitions[0]);
      expect(ev.ctx.schema).to.equal(schema);
    }
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
  let active: ReturnType<typeof collectEvents> | undefined;
  const subscribeChannel = getTracingChannel('graphql:subscribe');

  async function* twoTicks(): AsyncIterable<{ tick: string }> {
    await Promise.resolve();
    yield { tick: 'one' };
    yield { tick: 'two' };
  }

  afterEach(() => {
    active?.unsubscribe();
    active = undefined;
  });

  it('emits start and end for a synchronous subscription setup', async () => {
    active = collectEvents(subscribeChannel);

    const document = parse('subscription S { tick }');

    const result = subscribe({
      schema,
      document,
      rootValue: { tick: twoTicks },
    });
    const resolved = isPromise(result) ? await result : result;
    assert(isAsyncIterable(resolved));
    await resolved.return?.();

    expect(active.events.map((e) => e.kind)).to.deep.equal(['start', 'end']);
    expect(active.events[0].ctx.operationType).to.equal('subscription');
    expect(active.events[0].ctx.operationName).to.equal('S');
    expect(active.events[0].ctx.document).to.equal(document);
    expect(active.events[0].ctx.schema).to.equal(schema);
  });

  it('emits the full async lifecycle when subscribe resolver returns a promise', async () => {
    active = collectEvents(subscribeChannel);

    const document = parse('subscription { tick }');

    const result = subscribe({
      schema,
      document,
      rootValue: {
        tick: (): Promise<AsyncIterable<{ tick: string }>> =>
          Promise.resolve(twoTicks()),
      },
    });
    const resolved = isPromise(result) ? await result : result;
    assert(isAsyncIterable(resolved));
    await resolved.return?.();

    expect(active.events.map((e) => e.kind)).to.deep.equal([
      'start',
      'end',
      'asyncStart',
      'asyncEnd',
    ]);
  });

  it('emits only start and end for a synchronous validation failure', () => {
    active = collectEvents(subscribeChannel);

    // Invalid: no operation.
    const document = parse('fragment F on Subscription { tick }');

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    subscribe({ schema, document });

    expect(active.events.map((e) => e.kind)).to.deep.equal(['start', 'end']);
  });

  it('does not call tracing methods when no subscribers are attached', async () => {
    const document = parse('subscription { tick }');

    await expectNoTracingActivity(subscribeChannel, async () => {
      const result = subscribe({
        schema,
        document,
        rootValue: { tick: twoTicks },
      });
      const resolved = isPromise(result) ? await result : result;
      assert(isAsyncIterable(resolved));
      await resolved.return?.();
    });
  });
});

describe('resolve diagnostics channel', () => {
  let active: ReturnType<typeof collectEvents> | undefined;
  const resolveChannel = getTracingChannel('graphql:resolve');

  afterEach(() => {
    active?.unsubscribe();
    active = undefined;
  });

  it('emits start and end around a synchronous resolver', () => {
    active = collectEvents(resolveChannel);

    const result = execute({
      schema,
      document: parse('{ sync }'),
      rootValue: { sync: () => 'hello' },
    });
    if (isPromise(result)) {
      throw new Error('expected sync');
    }

    const starts = active.events.filter((e) => e.kind === 'start');
    expect(starts.length).to.equal(1);
    expect(starts[0].ctx.fieldName).to.equal('sync');
    expect(starts[0].ctx.parentType).to.equal('Query');
    expect(starts[0].ctx.fieldType).to.equal('String');
    expect(starts[0].ctx.fieldPath).to.equal('sync');

    const kinds = active.events.map((e) => e.kind);
    expect(kinds).to.deep.equal(['start', 'end']);
  });

  it('emits the full async lifecycle when a resolver returns a promise', async () => {
    active = collectEvents(resolveChannel);

    const result = execute({
      schema,
      document: parse('{ async }'),
      rootValue: { async: () => Promise.resolve('hello-async') },
    });
    await result;

    const kinds = active.events.map((e) => e.kind);
    expect(kinds).to.deep.equal(['start', 'end', 'asyncStart', 'asyncEnd']);
  });

  it('emits start, error, end when a sync resolver throws', () => {
    active = collectEvents(resolveChannel);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    execute({
      schema,
      document: parse('{ fail }'),
      rootValue: {
        fail: () => {
          throw new Error('boom');
        },
      },
    });

    const kinds = active.events.map((e) => e.kind);
    expect(kinds).to.deep.equal(['start', 'error', 'end']);
  });

  it('emits full async lifecycle with error when a resolver rejects', async () => {
    active = collectEvents(resolveChannel);

    await execute({
      schema,
      document: parse('{ asyncFail }'),
      rootValue: {
        asyncFail: () => Promise.reject(new Error('async-boom')),
      },
    });

    const kinds = active.events.map((e) => e.kind);
    expect(kinds).to.deep.equal([
      'start',
      'end',
      'asyncStart',
      'error',
      'asyncEnd',
    ]);
    const errorEvent = active.events.find((e) => e.kind === 'error');
    expect((errorEvent?.ctx as { error?: Error }).error?.message).to.equal(
      'async-boom',
    );
  });

  it('reports isDefaultResolver based on field.resolve presence', () => {
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

    active = collectEvents(resolveChannel);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    execute({
      schema: trivialSchema,
      document: parse('{ trivial custom }'),
      rootValue: { trivial: 'value' },
    });

    const starts = active.events.filter((e) => e.kind === 'start');
    const byField = new Map(
      starts.map((e) => [e.ctx.fieldName, e.ctx.isDefaultResolver]),
    );
    expect(byField.get('trivial')).to.equal(true);
    expect(byField.get('custom')).to.equal(false);
  });

  it('serializes fieldPath lazily, joining path keys with dots', () => {
    active = collectEvents(resolveChannel);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    execute({
      schema,
      document: parse('{ nested { leaf } }'),
      rootValue: {
        nested: { leaf: 'leaf-value' },
      },
    });

    const starts = active.events.filter((e) => e.kind === 'start');
    const paths = starts.map((e) => e.ctx.fieldPath);
    expect(paths).to.deep.equal(['nested', 'nested.leaf']);
  });

  it('fires once per field, not per schema walk', () => {
    active = collectEvents(resolveChannel);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    execute({
      schema,
      document: parse('{ sync plain nested { leaf } }'),
      rootValue: {
        sync: () => 'hello',
        // no `plain` resolver, default property-access is used.
        plain: 'plain-value',
        nested: { leaf: 'leaf-value' },
      },
    });

    const starts = active.events.filter((e) => e.kind === 'start');
    const endsSync = active.events.filter((e) => e.kind === 'end');
    expect(starts.length).to.equal(4); // sync, plain, nested, nested.leaf
    expect(endsSync.length).to.equal(4);
  });

  it('emits per-field for serial mutation execution', async () => {
    active = collectEvents(resolveChannel);

    await execute({
      schema,
      document: parse('mutation M { first second }'),
      rootValue: {
        first: () => 'one',
        second: () => 'two',
      },
    });

    const starts = active.events.filter((e) => e.kind === 'start');
    expect(starts.map((e) => e.ctx.fieldName)).to.deep.equal([
      'first',
      'second',
    ]);
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
