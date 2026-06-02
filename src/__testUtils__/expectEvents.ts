import { expect } from 'chai';

import type { MinimalTracingChannel } from '../diagnostics.ts';

import type {
  TestTracingChannel,
  TracingSubChannel,
  TracingSubChannelRecord,
} from './diagnosticsTracing.ts';
import { tracingSubChannels } from './diagnosticsTracing.ts';

export type CollectedEvent = {
  [Channel in TracingSubChannel]: {
    channel: Channel;
    context: Parameters<MinimalTracingChannel[Channel]['publish']>[0];
  };
}[TracingSubChannel];

export type CollectedEventFor<TContext = unknown> = {
  [Channel in TracingSubChannel]: {
    channel: Channel;
    context: TContext;
  };
}[TracingSubChannel];

type ExpectedEventsFactory<TResult, TContext = unknown> = (
  result: Awaited<TResult>,
) => ReadonlyArray<CollectedEventFor<TContext>>;

/**
 * Collect GraphQL tracing events while `fn` runs, build the expected event
 * list from the callback result, and always unsubscribe before returning.
 */
export async function expectEvents<TContext = unknown, TResult = unknown>(
  channel: TestTracingChannel<TContext>,
  fn: () => TResult,
  getExpectedEvents: ExpectedEventsFactory<TResult, TContext>,
): Promise<void> {
  const events: Array<CollectedEventFor<TContext>> = [];
  const handler = {} as TracingSubChannelRecord<(context: TContext) => void>;

  for (const tracingSubChannel of tracingSubChannels) {
    handler[tracingSubChannel] = (context: TContext) => {
      const snapshot =
        typeof context === 'object' && context !== null
          ? { ...context }
          : context;
      events.push({
        channel: tracingSubChannel,
        context: snapshot,
      });
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
