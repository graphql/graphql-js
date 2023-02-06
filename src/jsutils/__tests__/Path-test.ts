import { expect } from 'chai';
import { describe, it } from 'mocha';

import { Path, pathToArray, Root } from '../Path.js';

describe('Path', () => {
  it('can create a Path', () => {
    const root = new Root();
    const first = new Path(root, 1, 'First');

    expect(first).to.deep.include({
      prev: root,
      key: 1,
      typename: 'First',
    });
  });

  it('can add a new key to an existing Path', () => {
    const first = new Path(new Root(), 1, 'First');
    const second = first.addPath('two', 'Second');

    expect(second).to.deep.include({
      prev: first,
      key: 'two',
      typename: 'Second',
    });
  });

  it('can convert a Path to an array of its keys', () => {
    const root = new Path(new Root(), 0, 'Root');
    const first = root.addPath('one', 'First');
    const second = first.addPath(2, 'Second');

    const path = pathToArray(second);
    expect(path).to.deep.equal([0, 'one', 2]);
  });
});
