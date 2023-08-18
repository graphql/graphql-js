import { expect } from 'chai';
import { describe, it } from 'mocha';

import { OrderedSet } from '../OrderedSet.js';

describe('OrderedSet', () => {
  it('empty sets are equal', () => {
    const orderedSetA = new OrderedSet([]).freeze();
    const orderedSetB = new OrderedSet([]).freeze();

    expect(orderedSetA).to.equal(orderedSetB);
  });

  it('sets with members in different orders or numbers are equal', () => {
    const a = { a: 'a' };
    const b = { b: 'b' };
    const c = { c: 'c' };
    const orderedSetA = new OrderedSet([a, b, c, a, undefined]).freeze();
    const orderedSetB = new OrderedSet([undefined, b, a, b, c]).freeze();

    expect(orderedSetA).to.not.equal(orderedSetB);
  });

  it('sets with members in different orders or numbers are equal', () => {
    const a = { a: 'a' };
    const b = { b: 'b' };
    const c = { c: 'c' };
    const d = { c: 'd' };
    const orderedSetA = new OrderedSet([a, b, c, a, undefined]).freeze();
    const orderedSetB = new OrderedSet([undefined, b, a, b, d]).freeze();

    expect(orderedSetA).to.not.equal(orderedSetB);
  });
});
