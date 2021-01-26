import { expect } from 'chai';
import { describe, it } from 'mocha';

import identityFunc from '../identityFunc';
import safeArrayFrom from '../safeArrayFrom';

describe('safeArrayFrom', () => {
  it('should convert collections into arrays', () => {
    expect(safeArrayFrom([])).to.deep.equal([]);
    expect(safeArrayFrom(new Set([1, 2, 3]))).to.deep.equal([1, 2, 3]);
    expect(safeArrayFrom(new Int8Array([1, 2, 3]))).to.deep.equal([1, 2, 3]);

    // eslint-disable-next-line no-new-wrappers
    expect(safeArrayFrom(new String('ABC'))).to.deep.equal(['A', 'B', 'C']);

    function getArguments() {
      return arguments;
    }
    expect(safeArrayFrom(getArguments())).to.deep.equal([]);

    const arrayLike = {};
    arrayLike[0] = 'Alpha';
    arrayLike[1] = 'Bravo';
    arrayLike[2] = 'Charlie';
    arrayLike.length = 3;

    expect(safeArrayFrom(arrayLike)).to.deep.equal([
      'Alpha',
      'Bravo',
      'Charlie',
    ]);

    const iteratable = {
      [Symbol.iterator]() {
        const values = [1, 2, 3];
        return {
          next() {
            const done = values.length === 0;
            const value = values.shift();

            return { done, value };
          },
        };
      },
    };
    expect(safeArrayFrom(iteratable)).to.deep.equal([1, 2, 3]);

    // istanbul ignore next (Never called and use just as a placeholder)
    function* generatorFunc() {
      yield 1;
      yield 2;
      yield 3;
    }
    expect(safeArrayFrom(generatorFunc())).to.deep.equal([1, 2, 3]);

    // But generator function itself is not iteratable
    expect(safeArrayFrom(generatorFunc)).to.equal(null);
  });

  it('should return `null` for non-collections', () => {
    expect(safeArrayFrom(null)).to.equal(null);
    expect(safeArrayFrom(undefined)).to.equal(null);

    expect(safeArrayFrom('ABC')).to.equal(null);
    expect(safeArrayFrom('0')).to.equal(null);
    expect(safeArrayFrom('')).to.equal(null);

    expect(safeArrayFrom(1)).to.equal(null);
    expect(safeArrayFrom(0)).to.equal(null);
    expect(safeArrayFrom(NaN)).to.equal(null);
    // eslint-disable-next-line no-new-wrappers
    expect(safeArrayFrom(new Number(123))).to.equal(null);

    expect(safeArrayFrom(true)).to.equal(null);
    expect(safeArrayFrom(false)).to.equal(null);
    // eslint-disable-next-line no-new-wrappers
    expect(safeArrayFrom(new Boolean(true))).to.equal(null);

    expect(safeArrayFrom({})).to.equal(null);
    expect(safeArrayFrom({ length: 3 })).to.equal(null);
    expect(safeArrayFrom({ iterable: true })).to.equal(null);

    const iteratorWithoutSymbol = { next: identityFunc };
    expect(safeArrayFrom(iteratorWithoutSymbol)).to.equal(null);

    const invalidIteratable = {
      [Symbol.iterator]: { next: identityFunc },
    };
    expect(safeArrayFrom(invalidIteratable)).to.equal(null);
  });
});
