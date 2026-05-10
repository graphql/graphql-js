import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectPromise } from '../../__testUtils__/expectPromise.ts';

import { promiseWithResolvers } from '../promiseWithResolvers.ts';

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
