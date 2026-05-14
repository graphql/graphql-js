import { describe, it } from 'node:test';

import { expect } from 'chai';

import { expectNoTracingActivity } from '../expectNoTracingActivity.ts';
import { expectPromise } from '../expectPromise.ts';

type TestTracingChannel = Parameters<typeof expectNoTracingActivity>[0];

function createFakeTracingChannel(): TestTracingChannel {
  function runStores<T>(
    context: object,
    fn: (this: object, ...args: Array<unknown>) => T,
    thisArg?: unknown,
    ...args: Array<unknown>
  ): T {
    return fn.apply((thisArg as object | undefined) ?? context, args);
  }

  return {
    hasSubscribers: false,
    traceSync(fn, context, thisArg, ...args) {
      return runStores(context, fn, thisArg, ...args);
    },
    start: {
      publish(_context) {
        return undefined;
      },
      runStores,
    },
    end: {
      publish(_context) {
        return undefined;
      },
      runStores,
    },
    asyncStart: {
      publish(_context) {
        return undefined;
      },
      runStores,
    },
    asyncEnd: {
      publish(_context) {
        return undefined;
      },
      runStores,
    },
    error: {
      publish(_context) {
        return undefined;
      },
      runStores,
    },
  };
}

describe('expectNoTracingActivity', () => {
  it('returns the callback result when no tracing methods are touched', async () => {
    const channel = createFakeTracingChannel();

    expect(
      await expectNoTracingActivity(channel, () => ({ value: 'ok' })),
    ).to.deep.equal({ value: 'ok' });
  });

  it('fails and restores methods when tracing activity occurs', async () => {
    const channel = createFakeTracingChannel();
    const originalPublish = channel.start.publish;

    await expectPromise(
      expectNoTracingActivity(channel, () => {
        channel.start.publish({ value: 1 });
      }),
    ).toRejectWith("expected [ 'start.publish' ] to deeply equal []");

    expect(channel.start.publish).to.equal(originalPublish);
  });

  it('fails when traceSync is called', async () => {
    const channel = createFakeTracingChannel();
    await expectPromise(
      expectNoTracingActivity(channel, () => {
        channel.traceSync(() => 'ok', {}, undefined);
      }),
    ).toRejectWith("expected [ 'traceSync' ] to deeply equal []");
  });

  it('fails when runStores is called', async () => {
    const channel = createFakeTracingChannel();
    await expectPromise(
      expectNoTracingActivity(channel, () => {
        channel.start.runStores({}, () => 'ok');
      }),
    ).toRejectWith("expected [ 'start.runStores' ] to deeply equal []");
  });
});
