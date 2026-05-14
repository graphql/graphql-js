import type { MinimalChannel, MinimalTracingChannel } from '../diagnostics.ts';

export type TracingSubChannel = {
  [Key in keyof MinimalTracingChannel]: MinimalTracingChannel[Key] extends MinimalChannel
    ? Key
    : never;
}[keyof MinimalTracingChannel];

export type TracingSubChannelRecord<TValue> = {
  [Channel in TracingSubChannel]: TValue;
};

export type TracingSubscriptionHandler<TContext = unknown> =
  TracingSubChannelRecord<(context: TContext) => void>;

export type TestTracingChannel<TContext = unknown> =
  MinimalTracingChannel<TContext> & {
    subscribe: (handler: TracingSubscriptionHandler<TContext>) => void;
    unsubscribe: (handler: TracingSubscriptionHandler<TContext>) => void;
  };

export const tracingSubChannels: ReadonlyArray<TracingSubChannel> = [
  'start',
  'end',
  'asyncStart',
  'asyncEnd',
  'error',
];
