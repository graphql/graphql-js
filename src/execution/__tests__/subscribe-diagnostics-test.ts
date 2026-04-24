import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';

import {
  collectEvents,
  getTracingChannel,
} from '../../__testUtils__/diagnosticsTestUtils.js';

import { isPromise } from '../../jsutils/isPromise.js';

import { parse } from '../../language/parser.js';

import { GraphQLObjectType } from '../../type/definition.js';
import { GraphQLString } from '../../type/scalars.js';
import { GraphQLSchema } from '../../type/schema.js';

import { subscribe } from '../execute.js';

function buildSubscriptionSchema(
  subscribeFn: () => AsyncIterable<{ tick: string }>,
): GraphQLSchema {
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: { dummy: { type: GraphQLString } },
    }),
    subscription: new GraphQLObjectType({
      name: 'Subscription',
      fields: {
        tick: {
          type: GraphQLString,
          subscribe: subscribeFn,
        },
      },
    }),
  });
}

async function* twoTicks(): AsyncIterable<{ tick: string }> {
  await Promise.resolve();
  yield { tick: 'one' };
  yield { tick: 'two' };
}

const subscribeChannel = getTracingChannel('graphql:subscribe');

describe('subscribe diagnostics channel', () => {
  let active: ReturnType<typeof collectEvents> | undefined;

  afterEach(() => {
    active?.unsubscribe();
    active = undefined;
  });

  it('emits start and end for a synchronous subscription setup', async () => {
    active = collectEvents(subscribeChannel);

    const schema = buildSubscriptionSchema(twoTicks);
    const document = parse('subscription S { tick }');

    const result = subscribe({ schema, document });
    const resolved = isPromise(result) ? await result : result;
    if (!(Symbol.asyncIterator in resolved)) {
      throw new Error('Expected an async iterator');
    }
    await resolved.return?.();

    expect(active.events.map((e) => e.kind)).to.deep.equal(['start', 'end']);
    expect(active.events[0].ctx.operationType).to.equal('subscription');
    expect(active.events[0].ctx.operationName).to.equal('S');
    expect(active.events[0].ctx.document).to.equal(document);
    expect(active.events[0].ctx.schema).to.equal(schema);
  });

  it('emits the full async lifecycle when subscribe resolver returns a promise', async () => {
    active = collectEvents(subscribeChannel);

    const asyncResolver = (): Promise<AsyncIterable<{ tick: string }>> =>
      Promise.resolve(twoTicks());
    const schema = buildSubscriptionSchema(
      asyncResolver as unknown as () => AsyncIterable<{ tick: string }>,
    );
    const document = parse('subscription { tick }');

    const result = subscribe({ schema, document });
    const resolved = isPromise(result) ? await result : result;
    if (!(Symbol.asyncIterator in resolved)) {
      throw new Error('Expected an async iterator');
    }
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

    const schema = buildSubscriptionSchema(twoTicks);
    // Invalid: no operation.
    const document = parse('fragment F on Subscription { tick }');

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    subscribe({ schema, document });

    expect(active.events.map((e) => e.kind)).to.deep.equal(['start', 'end']);
  });

  it('does nothing when no subscribers are attached', async () => {
    const schema = buildSubscriptionSchema(twoTicks);
    const document = parse('subscription { tick }');

    const result = subscribe({ schema, document });
    const resolved = isPromise(result) ? await result : result;
    if (Symbol.asyncIterator in resolved) {
      await resolved.return?.();
    }
  });
});
