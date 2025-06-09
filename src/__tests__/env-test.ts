import { expect } from 'chai';
import { describe, it } from 'mocha';

const { getEnv: defaultGetEnv } = await import(`../env.js?ts${Date.now()}`);
const { getEnv: developmentGetEnv, setEnv: developmentSetEnv } = await import(
  `../env.js?ts${Date.now()}`
);
const { getEnv: productionGetEnv, setEnv: productionSetEnv } = await import(
  `../env.js?ts${Date.now()}`
);
const { setEnv: repetitiveSetEnv } = await import(`../env.js?ts${Date.now()}`);

describe('Env', () => {
  it('should return undefined if environment is not set', () => {
    expect(defaultGetEnv()).to.equal(undefined);
  });

  it('should set the environment to development', () => {
    developmentSetEnv('development');
    expect(developmentGetEnv()).to.equal('development');
  });

  it('should set the environment to production', () => {
    productionSetEnv('production');
    expect(productionGetEnv()).to.equal('production');
  });

  it('should throw if environment already set', () => {
    repetitiveSetEnv('development');
    expect(() => repetitiveSetEnv('production')).to.throw(
      'Environment already set to "development", cannot be changed to "production".',
    );
  });
});
