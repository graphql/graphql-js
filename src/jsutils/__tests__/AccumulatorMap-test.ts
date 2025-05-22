import { expect } from 'chai';
import { describe, it } from 'mocha';

import { AccumulatorMap } from '../AccumulatorMap.js';

function expectMap<K, V>(map: Map<K, V>) {
  return expect(Object.fromEntries(map));
}

describe('AccumulatorMap', () => {
  it('can be Object.toStringified', () => {
    const accumulatorMap = new AccumulatorMap();

    expect(Object.prototype.toString.call(accumulatorMap)).to.equal(
      '[object AccumulatorMap]',
    );
  });

  it('accumulate items', () => {
    const accumulatorMap = new AccumulatorMap<string, number>();

    expectMap(accumulatorMap).to.deep.equal({});

    accumulatorMap.add('a', 1);
    accumulatorMap.add('b', 2);
    accumulatorMap.add('c', 3);
    accumulatorMap.add('b', 4);
    accumulatorMap.add('c', 5);
    accumulatorMap.add('c', 6);
    expectMap(accumulatorMap).to.deep.equal({
      a: [1],
      b: [2, 4],
      c: [3, 5, 6],
    });
  });
});
