import { describe, it } from 'node:test';

import { expect } from 'chai';

import { addPath, pathToArray, pathToDigest } from '../Path.ts';

describe('Path', () => {
  it('can create a Path', () => {
    const first = addPath(undefined, 1, 'First');

    expect(first).to.deep.equal({
      prev: undefined,
      key: 1,
      typename: 'First',
      nonNull: false,
    });
  });

  it('can add a new key to an existing Path', () => {
    const first = addPath(undefined, 1, 'First');
    const second = addPath(first, 'two', 'Second', true);

    expect(second).to.deep.equal({
      prev: first,
      key: 'two',
      typename: 'Second',
      nonNull: true,
    });
  });

  it('can convert a Path to an array of its keys', () => {
    const root = addPath(undefined, 0, 'Root');
    const first = addPath(root, 'one', 'First');
    const second = addPath(first, 2, 'Second');

    const path = pathToArray(second);
    expect(path).to.deep.equal([0, 'one', 2]);

    expect(pathToDigest(second)).to.deep.equal({
      path: [0, 'one', 2],
      pathNonNull: [false, false, false],
    });
  });
});
