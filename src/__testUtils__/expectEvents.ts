import { expect } from 'chai';

import type { MinimalTracingChannel } from '../diagnostics.js';

import type {
  TestTracingChannel,
  TracingSubChannel,
  TracingSubChannelRecord,
} from './diagnosticsTracing.js';
import { tracingSubChannels } from './diagnosticsTracing.js';

export type CollectedEvent = {
  [Channel in TracingSubChannel]: {
    channel: Channel;
    context: Parameters<MinimalTracingChannel[Channel]['publish']>[0];
  };
}[TracingSubChannel];

type ExpectedEventsFactory<TResult> = (
  result: Awaited<TResult>,
) => ReadonlyArray<CollectedEvent>;

/**
 * Collect graphql tracing events while `fn` runs, build the expected event
 * list from the callback result, and always unsubscribe before returning.
 */
export async function expectEvents<TResult>(
  channel: TestTracingChannel,
  fn: () => TResult,
  getExpectedEvents: ExpectedEventsFactory<TResult>,
): Promise<void> {
  const events: Array<CollectedEvent> = [];
  const handler = {} as TracingSubChannelRecord<(context: unknown) => void>;

  for (const tracingSubChannel of tracingSubChannels) {
    handler[tracingSubChannel] = (context: unknown) => {
      const snapshot =
        typeof context === 'object' && context !== null
          ? { ...context }
          : context;
      events.push({ channel: tracingSubChannel, context: snapshot });
    };
  }

  channel.subscribe(handler);

  try {
    const resolvedResult = await fn();
    expect(events).to.deep.equal(getExpectedEvents(resolvedResult));
  } finally {
    channel.unsubscribe(handler);
  }
}
