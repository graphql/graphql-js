import { expect } from 'chai';
import { describe, it } from 'mocha';

import { addPath, pathToArray } from '../Path';

describe('Path', () => {
  it('can create a Path', () => {
    const first = addPath(undefined, 1, 'First');

    expect(first).to.deep.equal({
      prev: undefined,
      key: 1,
      typename: 'First',
    });
  });

  it('can add a new key to an existing Path', () => {
    const first = addPath(undefined, 1, 'First');
    const second = addPath(first, 'two', 'Second');

    expect(second).to.deep.equal({
      prev: first,
      key: 'two',
      typename: 'Second',
    });
  });

  it('can convert a Path to an array of its keys', () => {
    const root = addPath(undefined, 0, 'Root');
    const first = addPath(root, 'one', 'First');
    const second = addPath(first, 2, 'Second');

    const path = pathToArray(second);
    expect(path).to.deep.equal([0, 'one', 2]);
  });
});
