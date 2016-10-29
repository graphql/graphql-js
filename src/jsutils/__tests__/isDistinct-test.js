import { expect } from 'chai';
import { describe, it } from 'mocha';
import isDistinct from '../isDistinct';

describe('isDistinct', () => {

  it('will determine whether all items in an array are distinct', () => {
    const obj = {};
    expect(isDistinct([ 1, 2, 3 ])).to.equal(true);
    expect(isDistinct([ 1, 2, 3, 2, 1 ])).to.equal(false);
    expect(isDistinct([ 1, 1 ])).to.equal(false);
    expect(isDistinct([ 4, 5, 6 ])).to.equal(true);
    expect(isDistinct([ {}, {}, {} ])).to.equal(true);
    expect(isDistinct([ obj, obj, obj ])).to.equal(false);
  });

});
