/* eslint-disable import/no-nodejs-modules */
import dc from 'node:diagnostics_channel';

import { expect } from 'chai';
import { describe, it } from 'mocha';

import { invariant } from '../jsutils/invariant.js';

import { getChannels } from '../diagnostics.js';

describe('diagnostics', () => {
  it('auto-registers the five graphql tracing channels', () => {
    const channels = getChannels();
    invariant(channels !== undefined);

    // Node's `tracingChannel(name)` returns a fresh wrapper per call but
    // the underlying sub-channels are cached by name, so compare those.
    const byName = {
      execute: 'graphql:execute',
      parse: 'graphql:parse',
      validate: 'graphql:validate',
      resolve: 'graphql:resolve',
      subscribe: 'graphql:subscribe',
    } as const;
    for (const [key, name] of Object.entries(byName)) {
      expect(channels[key as keyof typeof byName].start).to.equal(
        dc.channel(`tracing:${name}:start`),
      );
    }
  });
});
