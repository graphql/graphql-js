import { expect } from 'chai';
import { describe, it } from 'mocha';

import identityFunc from '../identityFunc';
import isCollection from '../isCollection';

describe('isCollection', () => {
  it('should return `true` for collections', () => {
    expect(isCollection([])).to.equal(true);
    expect(isCollection(new Int8Array(1))).to.equal(true);

    // eslint-disable-next-line no-new-wrappers
    expect(isCollection(new String('ABC'))).to.equal(true);

    function getArguments() {
      return arguments;
    }
    expect(isCollection(getArguments())).to.equal(true);

    const arrayLike = {};
    arrayLike[0] = 'Alpha';
    arrayLike[1] = 'Bravo';
    arrayLike[2] = 'Charlie';
    arrayLike.length = 3;

    expect(isCollection(arrayLike)).to.equal(true);

    const iterator = { [Symbol.iterator]: identityFunc };
    expect(isCollection(iterator)).to.equal(true);

    // istanbul ignore next (Never called and use just as a placeholder)
    function* generatorFunc() {
      /* do nothing */
    }
    expect(isCollection(generatorFunc())).to.equal(true);

    // But generator function itself is not iteratable
    expect(isCollection(generatorFunc)).to.equal(false);
  });

  it('should return `false` for non-collections', () => {
    expect(isCollection(null)).to.equal(false);
    expect(isCollection(undefined)).to.equal(false);

    expect(isCollection('ABC')).to.equal(false);
    expect(isCollection('0')).to.equal(false);
    expect(isCollection('')).to.equal(false);

    expect(isCollection(1)).to.equal(false);
    expect(isCollection(0)).to.equal(false);
    expect(isCollection(NaN)).to.equal(false);
    // eslint-disable-next-line no-new-wrappers
    expect(isCollection(new Number(123))).to.equal(false);

    expect(isCollection(true)).to.equal(false);
    expect(isCollection(false)).to.equal(false);
    // eslint-disable-next-line no-new-wrappers
    expect(isCollection(new Boolean(true))).to.equal(false);

    expect(isCollection({})).to.equal(false);
    expect(isCollection({ iterable: true })).to.equal(false);

    const iteratorWithoutSymbol = { next: identityFunc };
    expect(isCollection(iteratorWithoutSymbol)).to.equal(false);

    const invalidIteratable = {
      [Symbol.iterator]: { next: identityFunc },
    };
    expect(isCollection(invalidIteratable)).to.equal(false);
  });
});
