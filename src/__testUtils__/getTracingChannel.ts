/* eslint-disable n/no-unsupported-features/node-builtins */
import dc from 'node:diagnostics_channel';

import type { GraphQLChannelContextByName } from '../diagnostics.ts';

import type { TestTracingChannel } from './diagnosticsTracing.ts';

/**
 * Resolve a GraphQL tracing channel by name on the real
 * `node:diagnostics_channel`. GraphQL.js publishes on the same channels at
 * module load.
 */
export function getTracingChannel<
  TName extends keyof GraphQLChannelContextByName,
>(name: TName): TestTracingChannel<GraphQLChannelContextByName[TName]>;
export function getTracingChannel(name: string): TestTracingChannel;
export function getTracingChannel(name: string): TestTracingChannel {
  return dc.tracingChannel(name) as TestTracingChannel;
}
