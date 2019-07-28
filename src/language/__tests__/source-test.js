// @flow strict

import { expect } from 'chai';
import { describe, it } from 'mocha';

import { Source } from '../source';

describe('Source', () => {
  it('can be Object.toStringified', () => {
    const source = new Source('');

    expect(Object.prototype.toString.call(source)).to.equal('[object Source]');
  });
});
