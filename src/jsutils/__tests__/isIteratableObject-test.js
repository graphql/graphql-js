import { expect } from 'chai';
import { describe, it } from 'mocha';

import { identityFunc } from '../identityFunc';
import { isIteratableObject } from '../isIteratableObject';

describe('isIteratableObject', () => {
  it('should return `true` for collections', () => {
    expect(isIteratableObject([])).to.equal(true);
    expect(isIteratableObject(new Int8Array(1))).to.equal(true);

    // eslint-disable-next-line no-new-wrappers
    expect(isIteratableObject(new String('ABC'))).to.equal(true);

    function getArguments() {
      return arguments;
    }
    expect(isIteratableObject(getArguments())).to.equal(true);

    const iterator = { [Symbol.iterator]: identityFunc };
    expect(isIteratableObject(iterator)).to.equal(true);

    // istanbul ignore next (Never called and use just as a placeholder)
    function* generatorFunc() {
      /* do nothing */
    }
    expect(isIteratableObject(generatorFunc())).to.equal(true);

    // But generator function itself is not iteratable
    expect(isIteratableObject(generatorFunc)).to.equal(false);
  });

  it('should return `false` for non-collections', () => {
    expect(isIteratableObject(null)).to.equal(false);
    expect(isIteratableObject(undefined)).to.equal(false);

    expect(isIteratableObject('ABC')).to.equal(false);
    expect(isIteratableObject('0')).to.equal(false);
    expect(isIteratableObject('')).to.equal(false);

    expect(isIteratableObject(1)).to.equal(false);
    expect(isIteratableObject(0)).to.equal(false);
    expect(isIteratableObject(NaN)).to.equal(false);
    // eslint-disable-next-line no-new-wrappers
    expect(isIteratableObject(new Number(123))).to.equal(false);

    expect(isIteratableObject(true)).to.equal(false);
    expect(isIteratableObject(false)).to.equal(false);
    // eslint-disable-next-line no-new-wrappers
    expect(isIteratableObject(new Boolean(true))).to.equal(false);

    expect(isIteratableObject({})).to.equal(false);
    expect(isIteratableObject({ iterable: true })).to.equal(false);

    const iteratorWithoutSymbol = { next: identityFunc };
    expect(isIteratableObject(iteratorWithoutSymbol)).to.equal(false);

    const invalidIteratable = {
      [Symbol.iterator]: { next: identityFunc },
    };
    expect(isIteratableObject(invalidIteratable)).to.equal(false);

    const arrayLike = {};
    arrayLike[0] = 'Alpha';
    arrayLike[1] = 'Bravo';
    arrayLike[2] = 'Charlie';
    arrayLike.length = 3;

    expect(isIteratableObject(arrayLike)).to.equal(false);
  });
});
