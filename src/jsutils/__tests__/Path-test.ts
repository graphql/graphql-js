import { expect } from 'chai';
import { describe, it } from 'mocha';

import type { Path } from '../Path';
import { addPath, pathToArray } from '../Path';

describe('Path', () => {
  it('can add a new key to an existing Path', () => {
    const first: Path = { prev: undefined, key: 1, typename: 'First' };
    const second = addPath(first, 'two', 'Second');
    expect(second.prev).to.equal(first);
    expect(second.key).to.equal('two');
    expect(second.typename).to.equal('Second');
  });

  it('can convert a Path to an array of its keys', () => {
    const root: Path = { prev: undefined, key: 0, typename: 'Root' };
    const first: Path = { prev: root, key: 'one', typename: 'First' };
    const second: Path = { prev: first, key: 2, typename: 'Second' };
    expect(pathToArray(second))
      .to.be.an('array')
      .that.deep.equals([0, 'one', 2]);
  });
});
