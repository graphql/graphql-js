import { expect } from 'chai';
import { describe, it } from 'mocha';

import { addPath, pathToArray, pathToDigest } from '../Path';

describe('Path', () => {
  it('can create a Path', () => {
    const first = addPath(undefined, 1, 'First', false);

    expect(first).to.deep.equal({
      prev: undefined,
      key: 1,
      typename: 'First',
      nonNull: false,
    });
  });

  it('can add a new key to an existing Path', () => {
    const first = addPath(undefined, 1, 'First', false);
    const second = addPath(first, 'two', 'Second', true);

    expect(second).to.deep.equal({
      prev: first,
      key: 'two',
      typename: 'Second',
      nonNull: true,
    });
  });

  it('can convert a Path to a path digest', () => {
    const root = addPath(undefined, 0, 'Root', false);
    const first = addPath(root, 'one', 'First', true);
    const second = addPath(first, 2, 'Second', false);

    const digest = pathToDigest(second);
    expect(digest).to.deep.equal({
      path: [0, 'one', 2],
      pathNonNull: [false, true, false],
    });

    // Also test legacy method
    const path = pathToArray(second);
    expect(path).to.deep.equal([0, 'one', 2]);
  });
});
