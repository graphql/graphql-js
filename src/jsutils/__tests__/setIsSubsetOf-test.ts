import { expect } from 'chai';
import { describe, it } from 'mocha';

import { setIsSubsetOf } from '../setIsSubsetOf.js';

describe('setIsSubsetOf', () => {
  it('setA is larger', () => {
    const setA = new Set(['A', 'B']);
    const setB = new Set(['A']);
    expect(setIsSubsetOf(setA, setB)).to.equal(false);
  });

  it('setA is smaller and a subset', () => {
    const setA = new Set(['A']);
    const setB = new Set(['A', 'B']);
    expect(setIsSubsetOf(setA, setB)).to.equal(true);
  });

  it('setA is smaller and not a subset', () => {
    const setA = new Set(['C']);
    const setB = new Set(['A', 'B']);
    expect(setIsSubsetOf(setA, setB)).to.equal(false);
  });
});
