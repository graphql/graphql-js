import { expect } from 'chai';

import type { MinimalTracingChannel } from '../diagnostics.js';

import { tracingSubChannels } from './diagnosticsTracing.js';
import { interceptMethod } from './interceptMethod.js';

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

  const calls: Array<string> = [];
  const restore: Array<() => void> = [];

  restore.push(
    interceptMethod(
      channel,
      'traceSync',
      (original) =>
        // c8 ignore next 5
        function interceptedTraceSync(
          this: unknown,
          ...args: Array<unknown>
        ): unknown {
          calls.push('traceSync');
          return original.apply(this, args);
        },
    ),
  );

  for (const phase of tracingSubChannels) {
    const subChannel = channel[phase];
    restore.push(
      interceptMethod(
        subChannel,
        'publish',
        (original) =>
          function interceptedPublish(
            this: unknown,
            ...args: Array<unknown>
          ): unknown {
            calls.push(`${phase}.publish`);
            return original.apply(this, args);
          },
      ),
    );
    restore.push(
      interceptMethod(
        subChannel,
        'runStores',
        (original) =>
          // c8 ignore next 6
          function interceptedRunStores(
            this: unknown,
            ...args: Array<unknown>
          ): unknown {
            calls.push(`${phase}.runStores`);
            return original.apply(this, args);
          },
      ),
    );
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
