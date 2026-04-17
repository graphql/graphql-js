import type {
  MinimalChannel,
  MinimalDiagnosticsChannel,
  MinimalTracingChannel,
} from '../diagnostics.js';

export type Listener = (message: unknown) => void;

/**
 * In-memory `MinimalChannel` implementation used by the unit tests. Tracks
 * subscribers and replays Node's `runStores` semantics by simply invoking
 * `fn`.
 */
export class FakeChannel implements MinimalChannel {
  listeners: Array<Listener> = [];

  get [Symbol.toStringTag]() {
    return 'FakeChannel';
  }

  get hasSubscribers(): boolean {
    return this.listeners.length > 0;
  }

  publish(message: unknown): void {
    for (const l of this.listeners) {
      l(message);
    }
  }

  runStores<T, ContextType extends object>(
    ctx: ContextType,
    fn: (this: ContextType, ...args: Array<unknown>) => T,
    thisArg?: unknown,
    ...args: Array<unknown>
  ): T {
    // Node's Channel.runStores publishes the context on the channel before
    // invoking fn. Mirror that here so traceSync / tracePromise fake exactly
    // matches real Node's start / end event counts.
    this.publish(ctx);
    return fn.apply(thisArg as ContextType, args);
  }

  subscribe(listener: Listener): void {
    this.listeners.push(listener);
  }

  unsubscribe(listener: Listener): void {
    const idx = this.listeners.indexOf(listener);
    if (idx >= 0) {
      this.listeners.splice(idx, 1);
    }
  }
}

/**
 * Structurally-faithful `MinimalTracingChannel` implementation mirroring
 * Node's `TracingChannel.traceSync` / `tracePromise` lifecycle (start,
 * runStores, error, asyncStart, asyncEnd, end).
 */
export class FakeTracingChannel implements MinimalTracingChannel {
  start: FakeChannel = new FakeChannel();
  end: FakeChannel = new FakeChannel();
  asyncStart: FakeChannel = new FakeChannel();
  asyncEnd: FakeChannel = new FakeChannel();
  error: FakeChannel = new FakeChannel();

  get [Symbol.toStringTag]() {
    return 'FakeTracingChannel';
  }

  get hasSubscribers(): boolean {
    return (
      this.start.hasSubscribers ||
      this.end.hasSubscribers ||
      this.asyncStart.hasSubscribers ||
      this.asyncEnd.hasSubscribers ||
      this.error.hasSubscribers
    );
  }

  traceSync<T>(
    fn: (...args: Array<unknown>) => T,
    ctx: object,
    thisArg?: unknown,
    ...args: Array<unknown>
  ): T {
    return this.start.runStores(ctx, () => {
      let result: T;
      try {
        result = fn.apply(thisArg as object, args);
      } catch (err) {
        (ctx as { error: unknown }).error = err;
        this.error.publish(ctx);
        this.end.publish(ctx);
        throw err;
      }
      // Node's real traceSync sets `ctx.result` before publishing `end`, so
      // subscribers can inspect `isPromise(ctx.result)` inside their `end`
      // handler to decide whether the operation is complete or async events
      // will follow. Match that semantic here.
      (ctx as { result: unknown }).result = result;
      this.end.publish(ctx);
      return result;
    });
  }

  tracePromise<T>(
    fn: (...args: Array<unknown>) => Promise<T>,
    ctx: object,
    thisArg?: unknown,
    ...args: Array<unknown>
  ): Promise<T> {
    return this.start.runStores(ctx, () => {
      let promise: Promise<T>;
      try {
        promise = fn.apply(thisArg as object, args);
      } catch (err) {
        (ctx as { error: unknown }).error = err;
        this.error.publish(ctx);
        this.end.publish(ctx);
        throw err;
      }
      this.end.publish(ctx);
      return promise.then(
        (result) => {
          (ctx as { result: unknown }).result = result;
          this.asyncStart.publish(ctx);
          try {
            return result;
          } finally {
            this.asyncEnd.publish(ctx);
          }
        },
        (err: unknown) => {
          (ctx as { error: unknown }).error = err;
          this.error.publish(ctx);
          this.asyncStart.publish(ctx);
          try {
            throw err;
          } finally {
            this.asyncEnd.publish(ctx);
          }
        },
      );
    });
  }
}

export class FakeDc implements MinimalDiagnosticsChannel {
  private cache = new Map<string, FakeTracingChannel>();

  get [Symbol.toStringTag]() {
    return 'FakeDc';
  }

  tracingChannel(name: string): FakeTracingChannel {
    let existing = this.cache.get(name);
    if (existing === undefined) {
      existing = new FakeTracingChannel();
      this.cache.set(name, existing);
    }
    return existing;
  }
}

export interface CollectedEvent {
  kind: 'start' | 'end' | 'asyncStart' | 'asyncEnd' | 'error';
  ctx: { [key: string]: unknown };
}

/**
 * Attach listeners to every sub-channel on a FakeTracingChannel and return
 * the captured event buffer plus an unsubscribe hook.
 */
export function collectEvents(channel: FakeTracingChannel): {
  events: Array<CollectedEvent>;
  unsubscribe: () => void;
} {
  const events: Array<CollectedEvent> = [];
  const make =
    (kind: CollectedEvent['kind']): Listener =>
    (m) =>
      events.push({ kind, ctx: m as { [key: string]: unknown } });
  const startL = make('start');
  const endL = make('end');
  const asyncStartL = make('asyncStart');
  const asyncEndL = make('asyncEnd');
  const errorL = make('error');
  channel.start.subscribe(startL);
  channel.end.subscribe(endL);
  channel.asyncStart.subscribe(asyncStartL);
  channel.asyncEnd.subscribe(asyncEndL);
  channel.error.subscribe(errorL);
  return {
    events,
    unsubscribe() {
      channel.start.unsubscribe(startL);
      channel.end.unsubscribe(endL);
      channel.asyncStart.unsubscribe(asyncStartL);
      channel.asyncEnd.unsubscribe(asyncEndL);
      channel.error.unsubscribe(errorL);
    },
  };
}
