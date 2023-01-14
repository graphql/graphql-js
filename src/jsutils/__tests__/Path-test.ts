import { expect } from 'chai';
import { describe, it } from 'mocha';

import { Path, pathToArray } from '../Path.js';

describe('Path', () => {
  it('can create a Path', () => {
    const first = new Path(undefined, 1, 'First');

    expect(first).to.deep.include({
      prev: undefined,
      key: 1,
      typename: 'First',
    });
  });

  it('can add a new key to an existing Path', () => {
    const first = new Path(undefined, 1, 'First');
    const second = first.addPath('two', 'Second');

    expect(second).to.deep.include({
      prev: first,
      key: 'two',
      typename: 'Second',
    });
  });

  it('can convert a Path to an array of its keys', () => {
    const root = new Path(undefined, 0, 'Root');
    const first = root.addPath('one', 'First');
    const second = first.addPath(2, 'Second');

    const path = pathToArray(second);
    expect(path).to.deep.equal([0, 'one', 2]);
  });
});
