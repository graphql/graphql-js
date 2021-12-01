import { expect } from 'chai';
import { describe, it } from 'mocha';

import { identityFunc } from '../identityFunc';
import { isIterableObject } from '../isIterableObject';

describe('isIterableObject', () => {
  it('should return `true` for collections', () => {
    expect(isIterableObject([])).to.equal(true);
    expect(isIterableObject(new Int8Array(1))).to.equal(true);

    // eslint-disable-next-line no-new-wrappers
    expect(isIterableObject(new String('ABC'))).to.equal(true);

    function getArguments() {
      return arguments;
    }
    expect(isIterableObject(getArguments())).to.equal(true);

    const iterable = { [Symbol.iterator]: identityFunc };
    expect(isIterableObject(iterable)).to.equal(true);

    function* generatorFunc() {
      /* do nothing */
    }
    expect(isIterableObject(generatorFunc())).to.equal(true);

    // But generator function itself is not iterable
    expect(isIterableObject(generatorFunc)).to.equal(false);
  });

  it('should return `false` for non-collections', () => {
    expect(isIterableObject(null)).to.equal(false);
    expect(isIterableObject(undefined)).to.equal(false);

    expect(isIterableObject('ABC')).to.equal(false);
    expect(isIterableObject('0')).to.equal(false);
    expect(isIterableObject('')).to.equal(false);

    expect(isIterableObject(1)).to.equal(false);
    expect(isIterableObject(0)).to.equal(false);
    expect(isIterableObject(NaN)).to.equal(false);
    // eslint-disable-next-line no-new-wrappers
    expect(isIterableObject(new Number(123))).to.equal(false);

    expect(isIterableObject(true)).to.equal(false);
    expect(isIterableObject(false)).to.equal(false);
    // eslint-disable-next-line no-new-wrappers
    expect(isIterableObject(new Boolean(true))).to.equal(false);

    expect(isIterableObject({})).to.equal(false);
    expect(isIterableObject({ iterable: true })).to.equal(false);

    const iteratorWithoutSymbol = { next: identityFunc };
    expect(isIterableObject(iteratorWithoutSymbol)).to.equal(false);

    const invalidIterable = {
      [Symbol.iterator]: { next: identityFunc },
    };
    expect(isIterableObject(invalidIterable)).to.equal(false);

    const arrayLike: { [key: string]: unknown } = {};
    arrayLike[0] = 'Alpha';
    arrayLike[1] = 'Bravo';
    arrayLike[2] = 'Charlie';
    arrayLike.length = 3;

    expect(isIterableObject(arrayLike)).to.equal(false);
  });
});
