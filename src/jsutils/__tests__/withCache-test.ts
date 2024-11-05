import { expect } from 'chai';
import { describe, it } from 'mocha';

import { resolveOnNextTick } from '../../__testUtils__/resolveOnNextTick.js';

import { isPromise } from '../isPromise.js';
import { withCache } from '../withCache.js';

describe('withCache', () => {
  it('returns asynchronously using asynchronous cache', async () => {
    let cached: string | undefined;
    let getAttempts = 0;
    let cacheHits = 0;
    const customCache = {
      set: async (result: string) => {
        await resolveOnNextTick();
        cached = result;
      },
      get: () => {
        getAttempts++;
        if (cached !== undefined) {
          cacheHits++;
        }
        return Promise.resolve(cached);
      },
    };

    const fnWithCache = withCache((arg: string) => arg, customCache);

    const firstResultPromise = fnWithCache('arg');
    expect(isPromise(firstResultPromise)).to.equal(true);
    const firstResult = await firstResultPromise;

    expect(firstResult).to.equal('arg');
    expect(getAttempts).to.equal(1);
    expect(cacheHits).to.equal(0);

    const secondResultPromise = fnWithCache('arg');

    expect(isPromise(secondResultPromise)).to.equal(true);

    const secondResult = await secondResultPromise;
    expect(secondResult).to.equal('arg');
    expect(getAttempts).to.equal(2);
    expect(cacheHits).to.equal(1);
  });

  it('returns synchronously using cache with sync getter and async setter', async () => {
    let cached: string | undefined;
    let getAttempts = 0;
    let cacheHits = 0;
    const customCache = {
      set: async (result: string) => {
        await resolveOnNextTick();
        cached = result;
      },
      get: () => {
        getAttempts++;
        if (cached !== undefined) {
          cacheHits++;
        }
        return cached;
      },
    };

    const fnWithCache = withCache((arg: string) => arg, customCache);

    const firstResult = fnWithCache('arg');
    expect(firstResult).to.equal('arg');
    expect(getAttempts).to.equal(1);
    expect(cacheHits).to.equal(0);

    await resolveOnNextTick();

    const secondResult = fnWithCache('arg');

    expect(secondResult).to.equal('arg');
    expect(getAttempts).to.equal(2);
    expect(cacheHits).to.equal(1);
  });

  it('returns asynchronously using cache with async getter and sync setter', async () => {
    let cached: string | undefined;
    let getAttempts = 0;
    let cacheHits = 0;
    const customCache = {
      set: (result: string) => {
        cached = result;
      },
      get: () => {
        getAttempts++;
        if (cached !== undefined) {
          cacheHits++;
        }
        return Promise.resolve(cached);
      },
    };

    const fnWithCache = withCache((arg: string) => arg, customCache);

    const firstResultPromise = fnWithCache('arg');
    expect(isPromise(firstResultPromise)).to.equal(true);
    const firstResult = await firstResultPromise;

    expect(firstResult).to.equal('arg');
    expect(getAttempts).to.equal(1);
    expect(cacheHits).to.equal(0);

    const secondResultPromise = fnWithCache('arg');

    expect(isPromise(secondResultPromise)).to.equal(true);

    const secondResult = await secondResultPromise;
    expect(secondResult).to.equal('arg');
    expect(getAttempts).to.equal(2);
    expect(cacheHits).to.equal(1);
  });

  it('ignores async setter errors', async () => {
    let cached: string | undefined;
    let getAttempts = 0;
    let cacheHits = 0;
    const customCache = {
      set: () => Promise.reject(new Error('Oops')),
      get: () => {
        getAttempts++;
        /* c8 ignore next 3 */
        if (cached !== undefined) {
          cacheHits++;
        }
        return Promise.resolve(cached);
      },
    };

    const fnWithCache = withCache((arg: string) => arg, customCache);

    const firstResultPromise = fnWithCache('arg');
    expect(isPromise(firstResultPromise)).to.equal(true);
    const firstResult = await firstResultPromise;

    expect(firstResult).to.equal('arg');
    expect(getAttempts).to.equal(1);
    expect(cacheHits).to.equal(0);

    const secondResultPromise = fnWithCache('arg');

    expect(isPromise(secondResultPromise)).to.equal(true);

    const secondResult = await secondResultPromise;
    expect(secondResult).to.equal('arg');
    expect(getAttempts).to.equal(2);
    expect(cacheHits).to.equal(0);
  });
});
