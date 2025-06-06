import { expect } from 'chai';
import { describe, it } from 'mocha';

import { getEnv, setEnv } from '../setEnv.js';

describe('Env', () => {
  it('should return undefined if environment is not set', () => {
    expect(getEnv()).to.equal(undefined);
  });

  it('should set the environment to development', () => {
    setEnv('development');
    expect(getEnv()).to.equal('development');
  });

  it('should set the environment to production', () => {
    setEnv('production');
    expect(getEnv()).to.equal('production');
  });
});
