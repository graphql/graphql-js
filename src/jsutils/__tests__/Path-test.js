// @flow strict

import { expect } from 'chai';
import { describe, it } from 'mocha';

import { type Path, addPath, pathToArray } from '../Path';

describe('Path', () => {
  it('can add a new key to an existing Path', () => {
    const first: Path = { prev: undefined, key: 1 };
    const second = addPath(first, 'two');
    expect(second.prev).to.equal(first);
    expect(second.key).to.equal('two');
  });

  it('can convert a Path to an array of its keys', () => {
    const root: Path = { prev: undefined, key: 0 };
    const first = { prev: root, key: 'one' };
    const second = { prev: first, key: 2 };
    expect(pathToArray(second))
      .to.be.an('array')
      .that.deep.equals([0, 'one', 2]);
  });
});
