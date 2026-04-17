import { expect } from 'chai';
import { describe, it } from 'mocha';

import { invariant } from '../jsutils/invariant.js';

import type {
  MinimalDiagnosticsChannel,
  MinimalTracingChannel,
} from '../diagnostics.js';
import { enableDiagnosticsChannel, getChannels } from '../diagnostics.js';

function fakeTracingChannel(name: string): MinimalTracingChannel {
  const noop: MinimalTracingChannel['start'] = {
    hasSubscribers: false,
    publish: () => {
      /* noop */
    },
    runStores: <T>(
      _ctx: unknown,
      fn: (this: unknown, ...args: Array<unknown>) => T,
    ): T => fn(),
  };
  const channel: MinimalTracingChannel & { _name: string } = {
    _name: name,
    hasSubscribers: false,
    start: noop,
    end: noop,
    asyncStart: noop,
    asyncEnd: noop,
    error: noop,
    traceSync: <T>(fn: (...args: Array<unknown>) => T): T => fn(),
    tracePromise: <T>(
      fn: (...args: Array<unknown>) => Promise<T>,
    ): Promise<T> => fn(),
  };
  return channel;
}

function fakeDc(): MinimalDiagnosticsChannel & {
  created: Array<string>;
} {
  const created: Array<string> = [];
  const cache = new Map<string, MinimalTracingChannel>();
  return {
    created,
    tracingChannel(name: string) {
      let existing = cache.get(name);
      if (existing === undefined) {
        created.push(name);
        existing = fakeTracingChannel(name);
        cache.set(name, existing);
      }
      return existing;
    },
  };
}

describe('diagnostics', () => {
  it('registers the five graphql tracing channels', () => {
    const dc = fakeDc();
    enableDiagnosticsChannel(dc);

    expect(dc.created).to.deep.equal([
      'graphql:execute',
      'graphql:parse',
      'graphql:validate',
      'graphql:resolve',
      'graphql:subscribe',
    ]);

    const channels = getChannels();
    invariant(channels !== undefined);
    expect(channels.execute).to.not.equal(undefined);
    expect(channels.parse).to.not.equal(undefined);
    expect(channels.validate).to.not.equal(undefined);
    expect(channels.resolve).to.not.equal(undefined);
    expect(channels.subscribe).to.not.equal(undefined);
  });

  it('re-registration with the same module preserves channel identity', () => {
    const dc = fakeDc();
    enableDiagnosticsChannel(dc);
    const first = getChannels();
    invariant(first !== undefined);

    enableDiagnosticsChannel(dc);
    const second = getChannels();
    invariant(second !== undefined);

    expect(second.execute).to.equal(first.execute);
    expect(second.parse).to.equal(first.parse);
    expect(second.validate).to.equal(first.validate);
    expect(second.resolve).to.equal(first.resolve);
    expect(second.subscribe).to.equal(first.subscribe);
  });

  it('re-registration with a different module replaces stored references', () => {
    const dc1 = fakeDc();
    const dc2 = fakeDc();

    enableDiagnosticsChannel(dc1);
    const first = getChannels();
    invariant(first !== undefined);

    enableDiagnosticsChannel(dc2);
    const second = getChannels();
    invariant(second !== undefined);

    expect(second.execute).to.not.equal(first.execute);
  });
});
