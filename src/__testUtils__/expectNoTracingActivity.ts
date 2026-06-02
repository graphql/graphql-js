import { expect } from 'chai';

import type { MinimalTracingChannel } from '../diagnostics.ts';

import { tracingSubChannels } from './diagnosticsTracing.ts';
import type { MethodSpy } from './spyOn.ts';
import { spyOnMethod } from './spyOn.ts';

/**
 * Assert that a GraphQL tracing channel stays on its zero-subscriber fast path.
 * The test installs spies around the real tracing methods and verifies none
 * of them were touched while `fn` ran.
 */
export async function expectNoTracingActivity<T, TContext = unknown>(
  channel: MinimalTracingChannel<TContext>,
  fn: () => T | Promise<T>,
): Promise<Awaited<T>> {
  expect(channel.hasSubscribers).to.equal(false);

  const namedSpies: Array<[string, MethodSpy]> = [];
  namedSpies.push(['traceSync', spyOnMethod(channel, 'traceSync')]);

  for (const phase of tracingSubChannels) {
    const subChannel = channel[phase];
    namedSpies.push([`${phase}.publish`, spyOnMethod(subChannel, 'publish')]);
    namedSpies.push([
      `${phase}.runStores`,
      spyOnMethod(subChannel, 'runStores'),
    ]);
  }

  try {
    const result = await fn();
    const calledMethods = namedSpies
      .filter(([, spy]) => spy.callCount > 0)
      .map(([name]) => name);
    expect(calledMethods).to.deep.equal([]);
    return result;
  } finally {
    for (const [, spy] of namedSpies) {
      spy.restore();
    }
  }
}
