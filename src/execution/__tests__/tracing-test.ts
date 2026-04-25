import { assert, expect } from 'chai';
import { afterEach, describe, it } from 'mocha';

import {
  collectEvents,
  getTracingChannel,
} from '../../__testUtils__/diagnosticsTestUtils.js';

import { isAsyncIterable } from '../../jsutils/isAsyncIterable.js';
import { isPromise } from '../../jsutils/isPromise.js';

import { parse } from '../../language/parser.js';

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
    dummy: String
  }

  type Subscription {
    tick: String
  }
`);

describe('execute diagnostics channel', () => {
  let active: ReturnType<typeof collectEvents> | undefined;
  const executeChannel = getTracingChannel('graphql:execute');

  const rootValue = {
    sync: () => 'hello',
    async: () => Promise.resolve('hello-async'),
  };

  afterEach(() => {
    active?.unsubscribe();
    active = undefined;
  });

  it('emits start and end around a synchronous execute', () => {
    active = collectEvents(executeChannel);

    const document = parse('query Q { sync }');
    const result = execute({ schema, document, rootValue });

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
    const result = await execute({ schema, document, rootValue });

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
    executeSync({ schema, document, rootValue });

    expect(active.events.map((e) => e.kind)).to.deep.equal(['start', 'end']);
  });

  it('emits start and end around executeIgnoringIncremental', () => {
    active = collectEvents(executeChannel);

    const document = parse('query Q { sync }');
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    executeIgnoringIncremental({ schema, document, rootValue });

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
    expect(() =>
      execute({ schema: schemaWithDefer, document, rootValue }),
    ).to.throw();

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

  it('does nothing when no subscribers are attached', () => {
    const document = parse('{ sync }');
    const result = execute({ schema, document, rootValue });
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
    subscribe({ schema, document, rootValue: { tick: twoTicks } });

    expect(active.events.map((e) => e.kind)).to.deep.equal(['start', 'end']);
  });

  it('does nothing when no subscribers are attached', async () => {
    const document = parse('subscription { tick }');

    const result = subscribe({
      schema,
      document,
      rootValue: { tick: twoTicks },
    });
    const resolved = isPromise(result) ? await result : result;
    if (isAsyncIterable(resolved)) {
      await resolved.return?.();
    }
  });
});
