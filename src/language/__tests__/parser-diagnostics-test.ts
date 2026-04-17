import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';

import type {
  MinimalChannel,
  MinimalDiagnosticsChannel,
  MinimalTracingChannel,
} from '../../diagnostics.js';
import { enableDiagnosticsChannel } from '../../diagnostics.js';

import { parse } from '../parser.js';

type Listener = (message: unknown) => void;

class FakeChannel implements MinimalChannel {
  listeners: Array<Listener> = [];
  get hasSubscribers(): boolean {
    return this.listeners.length > 0;
  }

  publish(message: unknown): void {
    for (const l of this.listeners) {
      l(message);
    }
  }

  runStores<T, ContextType extends object>(
    _ctx: ContextType,
    fn: (this: ContextType, ...args: Array<unknown>) => T,
    thisArg?: unknown,
    ...args: Array<unknown>
  ): T {
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

class FakeTracingChannel implements MinimalTracingChannel {
  start = new FakeChannel();
  end = new FakeChannel();
  asyncStart = new FakeChannel();
  asyncEnd = new FakeChannel();
  error = new FakeChannel();

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
    this.start.publish(ctx);
    try {
      return this.end.runStores(ctx, fn, thisArg, ...args);
    } catch (err) {
      (ctx as { error: unknown }).error = err;
      this.error.publish(ctx);
      throw err;
    } finally {
      this.end.publish(ctx);
    }
  }

  tracePromise<T>(
    fn: (...args: Array<unknown>) => Promise<T>,
    ctx: object,
    thisArg?: unknown,
    ...args: Array<unknown>
  ): Promise<T> {
    this.start.publish(ctx);
    let promise: Promise<T>;
    try {
      promise = this.end.runStores(ctx, fn, thisArg, ...args);
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
        this.asyncEnd.publish(ctx);
        return result;
      },
      (err: unknown) => {
        (ctx as { error: unknown }).error = err;
        this.error.publish(ctx);
        this.asyncStart.publish(ctx);
        this.asyncEnd.publish(ctx);
        throw err;
      },
    );
  }
}

class FakeDc implements MinimalDiagnosticsChannel {
  private cache = new Map<string, FakeTracingChannel>();

  tracingChannel(name: string): FakeTracingChannel {
    let existing = this.cache.get(name);
    if (existing === undefined) {
      existing = new FakeTracingChannel();
      this.cache.set(name, existing);
    }
    return existing;
  }
}

const fakeDc = new FakeDc();
const parseChannel = fakeDc.tracingChannel('graphql:parse');

interface Event {
  kind: 'start' | 'end' | 'asyncStart' | 'asyncEnd' | 'error';
  source: unknown;
  error?: unknown;
}

function collectEvents(): { events: Array<Event>; unsubscribe: () => void } {
  const events: Array<Event> = [];
  const startL: Listener = (m) =>
    events.push({ kind: 'start', source: (m as { source: unknown }).source });
  const endL: Listener = (m) =>
    events.push({ kind: 'end', source: (m as { source: unknown }).source });
  const asyncStartL: Listener = (m) =>
    events.push({
      kind: 'asyncStart',
      source: (m as { source: unknown }).source,
    });
  const asyncEndL: Listener = (m) =>
    events.push({
      kind: 'asyncEnd',
      source: (m as { source: unknown }).source,
    });
  const errorL: Listener = (m) => {
    const msg = m as { source: unknown; error: unknown };
    events.push({ kind: 'error', source: msg.source, error: msg.error });
  };
  parseChannel.start.subscribe(startL);
  parseChannel.end.subscribe(endL);
  parseChannel.asyncStart.subscribe(asyncStartL);
  parseChannel.asyncEnd.subscribe(asyncEndL);
  parseChannel.error.subscribe(errorL);
  return {
    events,
    unsubscribe() {
      parseChannel.start.unsubscribe(startL);
      parseChannel.end.unsubscribe(endL);
      parseChannel.asyncStart.unsubscribe(asyncStartL);
      parseChannel.asyncEnd.unsubscribe(asyncEndL);
      parseChannel.error.unsubscribe(errorL);
    },
  };
}

describe('parse diagnostics channel', () => {
  let active: ReturnType<typeof collectEvents> | undefined;

  beforeEach(() => {
    enableDiagnosticsChannel(fakeDc);
  });

  afterEach(() => {
    active?.unsubscribe();
    active = undefined;
  });

  it('emits start and end around a successful parse', () => {
    active = collectEvents();

    const doc = parse('{ field }');

    expect(doc.kind).to.equal('Document');
    expect(active.events.map((e) => e.kind)).to.deep.equal(['start', 'end']);
    expect(active.events[0].source).to.equal('{ field }');
    expect(active.events[1].source).to.equal('{ field }');
  });

  it('emits start, error, and end when the parser throws', () => {
    active = collectEvents();

    expect(() => parse('{ ')).to.throw();

    const kinds = active.events.map((e) => e.kind);
    expect(kinds).to.deep.equal(['start', 'error', 'end']);
    expect(active.events[1].error).to.be.instanceOf(Error);
  });

  it('does nothing when no subscribers are attached', () => {
    const doc = parse('{ field }');
    expect(doc.kind).to.equal('Document');
  });
});
