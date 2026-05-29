/* eslint-disable n/no-unsupported-features/node-builtins */
import dc from 'node:diagnostics_channel';
import { describe, it } from 'node:test';

import { expect } from 'chai';

import { invariant } from '../jsutils/invariant.ts';

import type { MinimalTracingChannel } from '../diagnostics.ts';
import {
  executeChannel,
  executeRootSelectionSetChannel,
  executeVariableCoercionChannel,
  parseChannel,
  resolveChannel,
  shouldTrace,
  subscribeChannel,
  validateChannel,
} from '../diagnostics.ts';

describe('diagnostics', () => {
  it('auto-registers the graphql tracing channels', () => {
    invariant(parseChannel !== undefined);
    invariant(validateChannel !== undefined);
    invariant(executeChannel !== undefined);
    invariant(executeVariableCoercionChannel !== undefined);
    invariant(executeRootSelectionSetChannel !== undefined);
    invariant(subscribeChannel !== undefined);
    invariant(resolveChannel !== undefined);

    // Node's `tracingChannel(name)` returns a fresh wrapper per call but
    // the underlying sub-channels are cached by name, so compare those.
    expect(parseChannel.start).to.equal(
      dc.channel('tracing:graphql:parse:start'),
    );
    expect(validateChannel.start).to.equal(
      dc.channel('tracing:graphql:validate:start'),
    );
    expect(executeChannel.start).to.equal(
      dc.channel('tracing:graphql:execute:start'),
    );
    expect(executeVariableCoercionChannel.start).to.equal(
      dc.channel('tracing:graphql:execute:variableCoercion:start'),
    );
    expect(executeRootSelectionSetChannel.start).to.equal(
      dc.channel('tracing:graphql:execute:rootSelectionSet:start'),
    );
    expect(subscribeChannel.start).to.equal(
      dc.channel('tracing:graphql:subscribe:start'),
    );
    expect(resolveChannel.start).to.equal(
      dc.channel('tracing:graphql:resolve:start'),
    );
  });

  describe('shouldTrace', () => {
    it('returns false when channel is undefined', () => {
      expect(shouldTrace(undefined)).to.equal(false);
    });

    it('reflects the aggregate hasSubscribers on a real tracing channel', () => {
      const tc = dc.tracingChannel(
        'shouldTrace:aggregate',
      ) as unknown as MinimalTracingChannel;
      expect(shouldTrace(tc)).to.equal(false);

      const handler = {
        start: () => undefined,
        end: () => undefined,
        asyncStart: () => undefined,
        asyncEnd: () => undefined,
        error: () => undefined,
      };
      const realTC = dc.tracingChannel('shouldTrace:aggregate');
      realTC.subscribe(handler);
      try {
        expect(shouldTrace(tc)).to.equal(true);
      } finally {
        realTC.unsubscribe(handler);
      }
    });
  });
});
