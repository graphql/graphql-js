import { expect } from 'chai';
import { describe, it } from 'mocha';

import identityFunc from '../identityFunc';
import isAsyncIterable from '../isAsyncIterable';

describe('isAsyncIterable', () => {
  it('should return `true` for AsyncIterable', () => {
    const asyncIteratable = { [Symbol.asyncIterator]: identityFunc };
    expect(isAsyncIterable(asyncIteratable)).to.equal(true);

    // istanbul ignore next (Never called and use just as a placeholder)
    async function* asyncGeneratorFunc() {
      /* do nothing */
    }

    expect(isAsyncIterable(asyncGeneratorFunc())).to.equal(true);

    // But async generator function itself is not iteratable
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

    const iterator = { [Symbol.iterator]: identityFunc };
    expect(isAsyncIterable(iterator)).to.equal(false);

    // istanbul ignore next (Never called and use just as a placeholder)
    function* generatorFunc() {
      /* do nothing */
    }
    expect(isAsyncIterable(generatorFunc())).to.equal(false);

    const invalidAsyncIteratable = {
      [Symbol.asyncIterator]: { next: identityFunc },
    };
    expect(isAsyncIterable(invalidAsyncIteratable)).to.equal(false);
  });
});
