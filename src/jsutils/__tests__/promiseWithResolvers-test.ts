import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectPromise } from '../../__testUtils__/expectPromise.js';

import { promiseWithResolvers } from '../promiseWithResolvers.js';

describe('promiseWithResolvers', () => {
  it('resolves values', async () => {
    const { promise, resolve } = promiseWithResolvers();
    resolve('foo');
    expect(await expectPromise(promise).toResolve()).to.equal('foo');
  });

  it('rejects values', async () => {
    const { promise, reject } = promiseWithResolvers();
    const error = new Error('rejected');
    reject(error);
    await expectPromise(promise).toRejectWith('rejected');
  });
});
