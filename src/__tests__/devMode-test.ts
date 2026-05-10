import { describe, it } from 'node:test';

import { expect } from 'chai';

import { enableDevMode, isDevModeEnabled } from '../devMode.ts';

describe('dev mode', () => {
  it('should be disabled by default', () => {
    expect(isDevModeEnabled()).to.equal(false);
  });

  it('should enable development mode', () => {
    enableDevMode();
    expect(isDevModeEnabled()).to.equal(true);
  });
});
