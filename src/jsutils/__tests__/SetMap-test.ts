import { expect } from 'chai';
import { describe, it } from 'mocha';

import { SetMap } from '../SetMap';

describe('SetMap', () => {
  it('maps exact sets regardless of insertion order', () => {
    const cache = new SetMap<object, number>();
    const a = {};
    const b = {};

    cache.set(new Set([a, b]), 0);

    expect(cache.get(new Set([a, b]))).to.equal(0);
    expect(cache.get(new Set([b, a]))).to.equal(0);
  });

  it('distinguishes sets which share members', () => {
    const cache = new SetMap<object, number>();
    const a = {};
    const b = {};
    const c = {};

    cache.set(new Set([a, b]), 0);
    cache.set(new Set([a, c]), 1);
    cache.set(new Set([a, b, c]), 2);
    cache.set(new Set([c, b]), 3);

    expect(cache.get(new Set([a, b]))).to.equal(0);
    expect(cache.get(new Set([a, c]))).to.equal(1);
    expect(cache.get(new Set([a, b, c]))).to.equal(2);
    expect(cache.get(new Set([c, b]))).to.equal(3);
  });

  it('maps the empty set', () => {
    const cache = new SetMap<object, number>();

    expect(cache.get(new Set())).to.equal(undefined);
    cache.set(new Set(), 0);
    expect(cache.get(new Set())).to.equal(0);
  });

  it('replaces the value for an equivalent set', () => {
    const cache = new SetMap();
    const member = {};
    cache.set(new Set([member]), 1);
    cache.set(new Set([member]), 2);
    expect(cache.get(new Set([member]))).to.equal(2);
  });
});
