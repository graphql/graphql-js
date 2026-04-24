/* eslint-disable n/no-unsupported-features/node-builtins, import/no-nodejs-modules */
import dc from 'node:diagnostics_channel';

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
