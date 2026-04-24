/* eslint-disable import/no-nodejs-modules */
import dc from 'node:diagnostics_channel';

import { expect } from 'chai';
import { describe, it } from 'mocha';

import { invariant } from '../jsutils/invariant.js';

import {
  executeChannel,
  parseChannel,
  resolveChannel,
  subscribeChannel,
  validateChannel,
} from '../diagnostics.js';

describe('diagnostics', () => {
  it('auto-registers the five graphql tracing channels', () => {
    invariant(parseChannel !== undefined);
    invariant(validateChannel !== undefined);
    invariant(executeChannel !== undefined);
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
    expect(subscribeChannel.start).to.equal(
      dc.channel('tracing:graphql:subscribe:start'),
    );
    expect(resolveChannel.start).to.equal(
      dc.channel('tracing:graphql:resolve:start'),
    );
  });
});
