import { expect } from 'chai';
import { describe, it } from 'mocha';

import { identityFunc } from '../identityFunc';
import { isAsyncIterable } from '../isAsyncIterable';

describe('isAsyncIterable', () => {
  it('should return `true` for AsyncIterable', () => {
    const asyncIterable = { [Symbol.asyncIterator]: identityFunc };
    expect(isAsyncIterable(asyncIterable)).to.equal(true);

    async function* asyncGeneratorFunc() {
      /* do nothing */
    }

    expect(isAsyncIterable(asyncGeneratorFunc())).to.equal(true);

    // But async generator function itself is not iterable
    expect(isAsyncIterable(asyncGeneratorFunc)).to.equal(false);
  });

  it('should return `false` for all other values', () => {
    expect(isAsyncIterable(null)).to.equal(false);
    expect(isAsyncIterable(undefined)).to.equal(false);

    expect(isAsyncIterable('ABC')).to.equal(false);
    expect(isAsyncIterable('0')).to.equal(false);
    expect(isAsyncIterable('')).to.equal(false);

    expect(isAsyncIterable([])).to.equal(false);
    expect(isAsyncIterable(new Int8Array(1))).to.equal(false);

    expect(isAsyncIterable({})).to.equal(false);
    expect(isAsyncIterable({ iterable: true })).to.equal(false);

    const asyncIteratorWithoutSymbol = { next: identityFunc };
    expect(isAsyncIterable(asyncIteratorWithoutSymbol)).to.equal(false);

    const nonAsyncIterable = { [Symbol.iterator]: identityFunc };
    expect(isAsyncIterable(nonAsyncIterable)).to.equal(false);

    function* generatorFunc() {
      /* do nothing */
    }
    expect(isAsyncIterable(generatorFunc())).to.equal(false);

    const invalidAsyncIterable = {
      [Symbol.asyncIterator]: { next: identityFunc },
    };
    expect(isAsyncIterable(invalidAsyncIterable)).to.equal(false);
  });
});
