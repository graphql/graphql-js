import { expect } from 'chai';
import { describe, it } from 'mocha';

import { enableDevMode, isDevModeEnabled } from '../devMode.js';

describe('dev mode', () => {
  it('should be disabled by default', () => {
    expect(isDevModeEnabled()).to.equal(false);
  });

  it('should enable development mode', () => {
    enableDevMode();
    expect(isDevModeEnabled()).to.equal(true);
  });
});
