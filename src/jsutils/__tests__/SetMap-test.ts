import { describe, it } from 'node:test';

import { expect } from 'chai';

import { spyOn } from '../../__testUtils__/spyOn.ts';

import { SetMap } from '../SetMap.ts';

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

  it('supports undefined values', () => {
    const cache = new SetMap<object, undefined>();
    const member = {};

    cache.set(new Set([member]), undefined);

    expect(cache.get(new Set([member]))).to.equal(undefined);
    expect(cache.has(new Set([member]))).to.equal(true);
  });

  it('iterates canonical keys and values in insertion order', () => {
    const cache = new SetMap<object, number>();
    const a = {};
    const b = {};
    const first = new Set([a]);
    const second = new Set([a, b]);

    cache.set(first, 1);
    cache.set(second, 2);
    cache.set(new Set([a]), 3);

    expect(cache.size).to.equal(2);
    expect(Array.from(cache.keys())).to.deep.equal([first, second]);
    expect(Array.from(cache.values())).to.deep.equal([3, 2]);
    expect(Array.from(cache)).to.deep.equal([
      [first, 3],
      [second, 2],
    ]);
  });

  it('can insert values on demand', () => {
    const cache = new SetMap<object, number>();
    const member = {};

    expect(cache.getOrInsert(new Set([member]), 0)).to.equal(0);
    expect(cache.getOrInsert(new Set([member]), 1)).to.equal(0);
  });

  it('can compute values on demand', () => {
    const cache = new SetMap<object, number>();
    const member = {};
    const compute = spyOn(() => 0);

    expect(cache.getOrInsertComputed(new Set([member]), compute)).to.equal(0);
    expect(cache.getOrInsertComputed(new Set([member]), compute)).to.equal(0);
    expect(compute.callCount).to.equal(1);
  });

  it('does not recreate undefined values', () => {
    const cache = new SetMap<object, undefined>();
    const member = {};
    const compute = spyOn(() => undefined);

    expect(cache.getOrInsertComputed(new Set([member]), compute)).to.equal(
      undefined,
    );
    expect(cache.getOrInsertComputed(new Set([member]), compute)).to.equal(
      undefined,
    );
    expect(compute.callCount).to.equal(1);
  });

  it('updates values inserted during computation', () => {
    const cache = new SetMap<object, number>();
    const member = {};

    expect(
      cache.getOrInsertComputed(new Set([member]), (members) => {
        cache.set(members, 1);
        return 2;
      }),
    ).to.equal(2);
    expect(cache.get(new Set([member]))).to.equal(2);
  });
});
