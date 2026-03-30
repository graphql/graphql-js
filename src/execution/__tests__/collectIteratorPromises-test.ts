import { expect } from 'chai';
import { describe, it } from 'mocha';

import { collectIteratorPromises } from '../collectIteratorPromises.js';

describe('collectIteratorPromises', () => {
  it('collects promise values until completion', () => {
    const first = Promise.resolve(1);
    const second = Promise.resolve(2);
    const values: Array<unknown> = [first, 'x', second];

    const iterator: Iterator<unknown> = {
      next() {
        const value = values.shift();
        if (value === undefined) {
          return { done: true, value: undefined };
        }
        return { done: false, value };
      },
    };

    expect(collectIteratorPromises(iterator)).to.deep.equal([first, second]);
  });

  it('returns collected promises when draining throws', () => {
    const first = Promise.resolve(1);
    let nextCalls = 0;

    const iterator: Iterator<unknown> = {
      next() {
        nextCalls += 1;
        if (nextCalls === 1) {
          return { done: false, value: first };
        }
        throw new Error('bad');
      },
    };

    expect(collectIteratorPromises(iterator)).to.deep.equal([first]);
  });
});
