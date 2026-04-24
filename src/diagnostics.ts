/* eslint-disable no-undef, import/no-nodejs-modules, n/global-require, @typescript-eslint/no-require-imports */
/**
 * TracingChannel integration.
 *
 * graphql-js publishes lifecycle events on a set of named tracing channels
 * that APM tools can subscribe to in order to observe parse, validate,
 * execute, subscribe, and resolver behavior. At module load time graphql-js
 * resolves `node:diagnostics_channel` itself so APMs do not need to interact
 * with the graphql API to enable tracing. On runtimes that do not expose
 * `node:diagnostics_channel` (e.g., browsers) the load silently no-ops and
 * emission sites short-circuit.
 */

import { isPromise } from './jsutils/isPromise.js';

/**
 * Structural subset of `DiagnosticsChannel` sufficient for publishing and
 * subscriber gating. `node:diagnostics_channel`'s `Channel` satisfies this.
 *
 * @internal
 */
export interface MinimalChannel {
  readonly hasSubscribers: boolean;
  publish: (message: unknown) => void;
  runStores: <T, ContextType extends object>(
    context: ContextType,
    fn: (this: ContextType, ...args: Array<unknown>) => T,
    thisArg?: unknown,
    ...args: Array<unknown>
  ) => T;
}

/**
 * Structural subset of Node's `TracingChannel`. The `node:diagnostics_channel`
 * `TracingChannel` satisfies this by duck typing, so graphql-js does not need
 * a dependency on `@types/node` or on the runtime itself.
 *
 * @internal
 */
export interface MinimalTracingChannel {
  readonly hasSubscribers: boolean;
  readonly start: MinimalChannel;
  readonly end: MinimalChannel;
  readonly asyncStart: MinimalChannel;
  readonly asyncEnd: MinimalChannel;
  readonly error: MinimalChannel;

  traceSync: <T>(
    fn: (...args: Array<unknown>) => T,
    ctx: object,
    thisArg?: unknown,
    ...args: Array<unknown>
  ) => T;
}

interface DiagnosticsChannelModule {
  tracingChannel: (name: string) => MinimalTracingChannel;
}

/**
 * The collection of tracing channels graphql-js emits on. APMs subscribe to
 * these by name on their own `node:diagnostics_channel` import; both paths
 * land on the same channel instance because `tracingChannel(name)` is cached
 * by name.
 */
export interface GraphQLChannels {
  execute: MinimalTracingChannel;
  parse: MinimalTracingChannel;
  validate: MinimalTracingChannel;
  resolve: MinimalTracingChannel;
  subscribe: MinimalTracingChannel;
}

function resolveDiagnosticsChannel(): DiagnosticsChannelModule | undefined {
  let dc: DiagnosticsChannelModule | undefined;
  try {
    if (
      typeof process !== 'undefined' &&
      typeof (process as { getBuiltinModule?: (id: string) => unknown })
        .getBuiltinModule === 'function'
    ) {
      dc = (
        process as {
          getBuiltinModule: (id: string) => DiagnosticsChannelModule;
        }
      ).getBuiltinModule('node:diagnostics_channel');
    }
    if (!dc && typeof require === 'function') {
      // CJS fallback for runtimes that lack `process.getBuiltinModule`
      // (e.g. Node 20.0 - 20.15). ESM builds skip this branch because
      // `require` is undeclared there.
      dc = require('node:diagnostics_channel') as DiagnosticsChannelModule;
    }
  } catch {
    // diagnostics_channel not available on this runtime; tracing is a no-op.
  }
  return dc;
}

const dc = resolveDiagnosticsChannel();

/**
 * Per-channel handles, resolved once at module load. `undefined` when
 * `node:diagnostics_channel` isn't available. Emission sites read these
 * directly to keep the no-subscriber fast path to a single property access
 * plus a `hasSubscribers` check (no function calls, no closures).
 *
 * @internal
 */
export const parseChannel: MinimalTracingChannel | undefined =
  dc?.tracingChannel('graphql:parse');
/** @internal */
export const validateChannel: MinimalTracingChannel | undefined =
  dc?.tracingChannel('graphql:validate');
/** @internal */
export const executeChannel: MinimalTracingChannel | undefined =
  dc?.tracingChannel('graphql:execute');
/** @internal */
export const subscribeChannel: MinimalTracingChannel | undefined =
  dc?.tracingChannel('graphql:subscribe');
/** @internal */
export const resolveChannel: MinimalTracingChannel | undefined =
  dc?.tracingChannel('graphql:resolve');

/**
 * Publish a synchronous operation through `channel`. Caller has already
 * verified that a subscriber is attached; this helper exists only so the
 * traced path doesn't need to be duplicated at every emission site.
 *
 * @internal
 */
export function traceSync<T>(
  channel: MinimalTracingChannel,
  ctx: object,
  fn: () => T,
): T {
  return channel.traceSync(fn, ctx);
}

/**
 * Publish a mixed sync-or-promise operation through `channel`. Caller has
 * already verified that a subscriber is attached.
 *
 * @internal
 */
export function traceMixed<T>(
  channel: MinimalTracingChannel,
  ctxInput: object,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  const ctx = ctxInput as { error?: unknown; result?: unknown };

  return channel.start.runStores(ctx, () => {
    let result: T | Promise<T>;
    try {
      result = fn();
    } catch (err) {
      ctx.error = err;
      channel.error.publish(ctx);
      channel.end.publish(ctx);
      throw err;
    }

    if (!isPromise(result)) {
      ctx.result = result;
      channel.end.publish(ctx);
      return result;
    }

    channel.end.publish(ctx);
    channel.asyncStart.publish(ctx);

    return result
      .then(
        (value) => {
          ctx.result = value;
          return value;
        },
        (err: unknown) => {
          ctx.error = err;
          channel.error.publish(ctx);
          throw err;
        },
      )
      .finally(() => {
        channel.asyncEnd.publish(ctx);
      });
  });
}
