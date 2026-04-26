import type { MinimalChannel, MinimalTracingChannel } from '../diagnostics.js';

export type TracingSubChannel = {
  [Key in keyof MinimalTracingChannel]: MinimalTracingChannel[Key] extends MinimalChannel
    ? Key
    : never;
}[keyof MinimalTracingChannel];

export type TracingSubChannelRecord<TValue> = {
  [Channel in TracingSubChannel]: TValue;
};

export type TracingSubscriptionHandler = TracingSubChannelRecord<
  (context: unknown) => void
>;

export type TestTracingChannel = MinimalTracingChannel & {
  subscribe: (handler: TracingSubscriptionHandler) => void;
  unsubscribe: (handler: TracingSubscriptionHandler) => void;
};

export const tracingSubChannels: ReadonlyArray<TracingSubChannel> = [
  'start',
  'end',
  'asyncStart',
  'asyncEnd',
  'error',
];
