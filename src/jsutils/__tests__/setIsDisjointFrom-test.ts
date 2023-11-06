import { expect } from 'chai';
import { describe, it } from 'mocha';

import { setIsDisjointFrom } from '../setIsDisjointFrom.js';

describe('setIsDisjointFrom', () => {
  it('setA is smaller and disjointed', () => {
    const setA = new Set(['C']);
    const setB = new Set(['A', 'B']);
    expect(setIsDisjointFrom(setA, setB)).to.equal(true);
  });

  it('setA is smaller and not disjointed', () => {
    const setA = new Set(['B']);
    const setB = new Set(['A', 'B']);
    expect(setIsDisjointFrom(setA, setB)).to.equal(false);
  });

  it('setA is larger and disjointed', () => {
    const setA = new Set(['C', 'D', 'E']);
    const setB = new Set(['A', 'B']);
    expect(setIsDisjointFrom(setA, setB)).to.equal(false);
  });

  it('setA is larger and not disjointed', () => {
    const setA = new Set(['C', 'D', 'B']);
    const setB = new Set(['A', 'B']);
    expect(setIsDisjointFrom(setA, setB)).to.equal(false);
  });
});
