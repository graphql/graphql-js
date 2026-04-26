import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectEvents } from '../expectEvents.js';
import { expectPromise } from '../expectPromise.js';

type TestTracingChannel = Parameters<typeof expectEvents>[0];

function createFakeTracingChannel(): TestTracingChannel {
  let handler:
    | {
        start: (context: unknown) => void;
        end: (context: unknown) => void;
        asyncStart: (context: unknown) => void;
        asyncEnd: (context: unknown) => void;
        error: (context: unknown) => void;
      }
    | undefined;

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
    subscribe(nextHandler) {
      handler = nextHandler;
    },
    unsubscribe(nextHandler) {
      expect(handler).to.equal(nextHandler);
      handler = undefined;
    },
    traceSync(fn, _context, thisArg, ...args) {
      return fn.apply(thisArg, args);
    },
    start: {
      publish(context) {
        handler?.start(context);
      },
      runStores,
    },
    end: {
      publish(context) {
        handler?.end(context);
      },
      runStores,
    },
    asyncStart: {
      publish(context) {
        handler?.asyncStart(context);
      },
      runStores,
    },
    asyncEnd: {
      publish(context) {
        handler?.asyncEnd(context);
      },
      runStores,
    },
    error: {
      publish(context) {
        handler?.error(context);
      },
      runStores,
    },
  };
}

describe('expectEvents', () => {
  it('collects events and snapshots each published context', async () => {
    const channel = createFakeTracingChannel();
    const context = { value: 1 };

    await expectEvents(
      channel,
      () => {
        channel.start.publish(context);
        context.value = 2;
        channel.end.publish(context);
        return 'done';
      },
      (_result) => [
        {
          channel: 'start',
          context: { value: 1 },
        },
        {
          channel: 'end',
          context: { value: 2 },
        },
      ],
    );
  });

  it('unsubscribes when the callback rejects', async () => {
    let activeHandler: object | undefined;
    const error = new Error('boom');
    const channel = createFakeTracingChannel();
    const originalSubscribe = channel.subscribe;
    const originalUnsubscribe = channel.unsubscribe;

    channel.subscribe = (handler) => {
      activeHandler = handler;
      originalSubscribe.call(channel, handler);
    };
    channel.unsubscribe = (handler) => {
      expect(handler).to.equal(activeHandler);
      activeHandler = undefined;
      originalUnsubscribe.call(channel, handler);
    };

    expect(
      await expectPromise(
        expectEvents(
          channel,
          () => Promise.reject(error),
          () => [],
        ),
      ).toReject(),
    ).to.equal(error);
    expect(activeHandler).to.equal(undefined);
  });
});
