import { expect } from 'chai';
import { describe, it } from 'mocha';

import { sharedFakeDc } from '../__testUtils__/fakeDiagnosticsChannel.js';

import { invariant } from '../jsutils/invariant.js';

import { enableDiagnosticsChannel, getChannels } from '../diagnostics.js';

describe('diagnostics', () => {
  it('exposes the five graphql tracing channels after registration', () => {
    enableDiagnosticsChannel(sharedFakeDc);

    const channels = getChannels();
    invariant(channels !== undefined);
    expect(channels.execute).to.equal(
      sharedFakeDc.tracingChannel('graphql:execute'),
    );
    expect(channels.parse).to.equal(
      sharedFakeDc.tracingChannel('graphql:parse'),
    );
    expect(channels.validate).to.equal(
      sharedFakeDc.tracingChannel('graphql:validate'),
    );
    expect(channels.resolve).to.equal(
      sharedFakeDc.tracingChannel('graphql:resolve'),
    );
    expect(channels.subscribe).to.equal(
      sharedFakeDc.tracingChannel('graphql:subscribe'),
    );
  });

  it('re-registration with the same module is a no-op', () => {
    enableDiagnosticsChannel(sharedFakeDc);
    const first = getChannels();
    invariant(first !== undefined);

    enableDiagnosticsChannel(sharedFakeDc);
    const second = getChannels();

    expect(second).to.equal(first);
  });

  it('re-registration with a different module throws', () => {
    enableDiagnosticsChannel(sharedFakeDc);

    expect(() =>
      enableDiagnosticsChannel({
        tracingChannel: () => {
          throw new Error('should not be called');
        },
      }),
    ).to.throw(/different `diagnostics_channel` module/);
  });
});
