/* eslint-disable n/no-unsupported-features/node-builtins, import/no-nodejs-modules */
import dc from 'node:diagnostics_channel';

import type { TestTracingChannel } from './diagnosticsTracing.js';

/**
 * Resolve a graphql tracing channel by name on the real
 * `node:diagnostics_channel`. graphql-js publishes on the same channels at
 * module load.
 */
export function getTracingChannel(name: string): TestTracingChannel {
  return dc.tracingChannel(name) as TestTracingChannel;
}
