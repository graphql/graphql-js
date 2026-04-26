/* eslint-disable n/no-unsupported-features/node-builtins, import/no-nodejs-modules */
import dc from 'node:diagnostics_channel';

import { expect } from 'chai';

import type { MinimalTracingChannel } from '../diagnostics.js';

export interface CollectedEvent {
  kind: 'start' | 'end' | 'asyncStart' | 'asyncEnd' | 'error';
  ctx: { [key: string]: unknown };
}

/**
 * Subscribe to every lifecycle sub-channel on a TracingChannel and collect
 * events in order. Returns the event buffer plus an unsubscribe hook.
 */
export function collectEvents(channel: MinimalTracingChannel): {
  events: Array<CollectedEvent>;
  unsubscribe: () => void;
} {
  const events: Array<CollectedEvent> = [];
  const handler = {
    start: (ctx: unknown) =>
      events.push({ kind: 'start', ctx: ctx as { [key: string]: unknown } }),
    end: (ctx: unknown) =>
      events.push({ kind: 'end', ctx: ctx as { [key: string]: unknown } }),
    asyncStart: (ctx: unknown) =>
      events.push({
        kind: 'asyncStart',
        ctx: ctx as { [key: string]: unknown },
      }),
    asyncEnd: (ctx: unknown) =>
      events.push({
        kind: 'asyncEnd',
        ctx: ctx as { [key: string]: unknown },
      }),
    error: (ctx: unknown) =>
      events.push({ kind: 'error', ctx: ctx as { [key: string]: unknown } }),
  };
  (channel as unknown as dc.TracingChannel).subscribe(handler);
  return {
    events,
    unsubscribe() {
      (channel as unknown as dc.TracingChannel).unsubscribe(handler);
    },
  };
}

/**
 * Resolve a graphql tracing channel by name on the real
 * `node:diagnostics_channel`. graphql-js publishes on the same channels at
 * module load.
 */
export function getTracingChannel(name: string): MinimalTracingChannel {
  return dc.tracingChannel(name) as unknown as MinimalTracingChannel;
}

/**
 * Assert that a graphql tracing channel stays on its zero-subscriber fast path.
 * The test installs wrappers around the real tracing methods and verifies none
 * of them were touched while `fn` ran.
 */
export async function expectNoTracingActivity<T>(
  channel: MinimalTracingChannel,
  fn: () => T | Promise<T>,
): Promise<Awaited<T>> {
  expect(channel.hasSubscribers).to.equal(false);
  expect(channel.start.hasSubscribers).to.equal(false);
  expect(channel.end.hasSubscribers).to.equal(false);
  expect(channel.asyncStart.hasSubscribers).to.equal(false);
  expect(channel.asyncEnd.hasSubscribers).to.equal(false);
  expect(channel.error.hasSubscribers).to.equal(false);

  const calls: Array<string> = [];
  const restore: Array<() => void> = [];

  function interceptMethod(
    target: { [key: string]: unknown },
    key: string,
    name: string,
  ): void {
    const original = target[key] as (...args: Array<unknown>) => unknown;
    /* c8 ignore next 7 */
    target[key] = function interceptedMethod(
      this: unknown,
      ...args: Array<unknown>
    ) {
      calls.push(name);
      return original.apply(this, args);
    };
    restore.push(() => {
      target[key] = original;
    });
  }

  interceptMethod(
    channel as unknown as { [key: string]: unknown },
    'traceSync',
    'traceSync',
  );

  for (const phase of ['start', 'end', 'asyncStart', 'asyncEnd', 'error']) {
    const subChannel = channel[
      phase as keyof Pick<
        MinimalTracingChannel,
        'start' | 'end' | 'asyncStart' | 'asyncEnd' | 'error'
      >
    ] as unknown as { [key: string]: unknown };
    interceptMethod(subChannel, 'publish', `${phase}.publish`);
    interceptMethod(subChannel, 'runStores', `${phase}.runStores`);
  }

  try {
    const result = await fn();
    expect(calls).to.deep.equal([]);
    return result;
  } finally {
    while (restore.length > 0) {
      restore.pop()?.();
    }
  }
}
