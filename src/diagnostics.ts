/**
 * TracingChannel integration.
 *
 * graphql-js exposes a set of named tracing channels that APM tools can
 * subscribe to in order to observe parse, validate, execute, subscribe, and
 * resolver lifecycle events. To preserve the isomorphic invariant of the
 * core (no runtime-specific imports in `src/`), graphql-js does not import
 * `node:diagnostics_channel` itself. Instead, APMs (or runtime-specific
 * adapters) hand in a module satisfying `MinimalDiagnosticsChannel` via
 * `enableDiagnosticsChannel`.
 *
 * Channel names are owned by graphql-js so multiple APMs converge on the
 * same `TracingChannel` instances and all subscribers coexist.
 */

import { isPromise } from './jsutils/isPromise.js';

/**
 * Structural subset of `DiagnosticsChannel` sufficient for publishing and
 * subscriber gating. `node:diagnostics_channel`'s `Channel` satisfies this.
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

  tracePromise: <T>(
    fn: (...args: Array<unknown>) => Promise<T>,
    ctx: object,
    thisArg?: unknown,
    ...args: Array<unknown>
  ) => Promise<T>;
}

/**
 * Structural subset of `node:diagnostics_channel` covering just what
 * graphql-js needs at registration time.
 */
export interface MinimalDiagnosticsChannel {
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

let channels: GraphQLChannels | undefined;

/**
 * Internal accessor used at emission sites. Returns `undefined` when no
 * `diagnostics_channel` module has been registered, allowing emission sites
 * to short-circuit on a single property access.
 *
 * @internal
 */
export function getChannels(): GraphQLChannels | undefined {
  return channels;
}

/**
 * Register a `node:diagnostics_channel`-compatible module with graphql-js.
 *
 * After calling this, graphql-js will publish lifecycle events on the
 * following tracing channels whenever subscribers are present:
 *
 *   - `graphql:parse`
 *   - `graphql:validate`
 *   - `graphql:execute`
 *   - `graphql:subscribe`
 *   - `graphql:resolve`
 *
 * Calling this repeatedly is safe: subsequent calls replace the stored
 * channel references, but since `tracingChannel(name)` is cached by name,
 * the channel identities remain stable across registrations from the same
 * underlying module.
 *
 * @example
 * ```ts
 * import dc from 'node:diagnostics_channel';
 * import { enableDiagnosticsChannel } from 'graphql';
 *
 * enableDiagnosticsChannel(dc);
 * ```
 */
export function enableDiagnosticsChannel(dc: MinimalDiagnosticsChannel): void {
  channels = {
    execute: dc.tracingChannel('graphql:execute'),
    parse: dc.tracingChannel('graphql:parse'),
    validate: dc.tracingChannel('graphql:validate'),
    resolve: dc.tracingChannel('graphql:resolve'),
    subscribe: dc.tracingChannel('graphql:subscribe'),
  };
}

/**
 * Gate for emission sites. Returns `true` when the named channel exists and
 * publishing should proceed.
 *
 * Uses `!== false` rather than a truthy check so runtimes which do not
 * implement the aggregated `hasSubscribers` getter on `TracingChannel` still
 * publish. Notably Node 18 (nodejs/node#54470), where the aggregated getter
 * returns `undefined` while sub-channels behave correctly.
 *
 * @internal
 */
function shouldTrace(
  channel: MinimalTracingChannel | undefined,
): channel is MinimalTracingChannel {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare
  return channel !== undefined && channel.hasSubscribers !== false;
}

/**
 * Publish a synchronous operation through the named graphql tracing channel,
 * short-circuiting to `fn()` when the channel isn't registered or nothing is
 * listening.
 *
 * @internal
 */
export function maybeTraceSync<T>(
  name: keyof GraphQLChannels,
  ctxFactory: () => object,
  fn: () => T,
): T {
  const channel = getChannels()?.[name];
  if (!shouldTrace(channel)) {
    return fn();
  }
  return channel.traceSync(fn, ctxFactory());
}

/**
 * Publish a promise-returning operation through the named graphql tracing
 * channel, short-circuiting to `fn()` when the channel isn't registered or
 * nothing is listening.
 *
 * @internal
 */
export function maybeTracePromise<T>(
  name: keyof GraphQLChannels,
  ctxFactory: () => object,
  fn: () => Promise<T>,
): Promise<T> {
  const channel = getChannels()?.[name];
  if (!shouldTrace(channel)) {
    return fn();
  }
  return channel.tracePromise(fn, ctxFactory());
}

/**
 * Publish a mixed sync-or-promise operation through the named graphql tracing
 * channel.
 *
 * Mirrors Node's own `TracingChannel.tracePromise` for the async branch while
 * handling sync returns without the cost of a promise wrap. The entire
 * lifecycle runs inside `start.runStores`, which is what lets subscribers
 * that call `channel.start.bindStore(als, ...)` read that store in every
 * sub-channel handler: promise continuations attached inside a `runStores`
 * block inherit the AsyncLocalStorage context via async_hooks, so
 * `asyncStart` and `asyncEnd` fire with the same store active as `start`
 * and `end`.
 *
 * Subscribers can inspect `isPromise(ctx.result)` inside their `end` handler
 * to know whether `asyncEnd` will follow or the operation is complete. This
 * matches Node's convention.
 *
 * @internal
 */
export function maybeTraceMixed<T>(
  name: keyof GraphQLChannels,
  ctxFactory: () => object,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  const channel = getChannels()?.[name];
  if (!shouldTrace(channel)) {
    return fn();
  }
  const ctx = ctxFactory() as {
    error?: unknown;
    result?: unknown;
  };

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
    return result.then(
      (value) => {
        ctx.result = value;
        channel.asyncStart.publish(ctx);
        try {
          return value;
        } finally {
          channel.asyncEnd.publish(ctx);
        }
      },
      (err: unknown) => {
        ctx.error = err;
        channel.error.publish(ctx);
        channel.asyncStart.publish(ctx);
        try {
          throw err;
        } finally {
          channel.asyncEnd.publish(ctx);
        }
      },
    );
  });
}
