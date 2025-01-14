import { expect } from 'chai';
import { describe, it } from 'mocha';

import { getObjectAtPath } from '../getObjectAtPath.js';

describe('getObjectAtPath', () => {
  it('should return the object at the path', () => {
    const object = getObjectAtPath({ a: { b: { c: 1 } } }, ['a', 'b']);

    expect(object).to.deep.equal({ c: 1 });
  });

  it('should return the array at the path', () => {
    const object = getObjectAtPath({ a: { b: [{ c: 1 }] } }, ['a', 'b']);

    expect(object).to.deep.equal([{ c: 1 }]);
  });

  it('should throw for invalid path missing array index', () => {
    expect(() =>
      getObjectAtPath({ a: [{ b: { c: 1 } }] }, ['a', 'b']),
    ).to.throw();
  });

  it('should throw for invalid path with unexpected array index', () => {
    expect(() => getObjectAtPath({ a: { b: { c: 1 } } }, ['a', 0])).to.throw();
  });

  it('should throw for invalid path with neither string nor array index', () => {
    expect(() =>
      // @ts-expect-error
      getObjectAtPath({ a: [{ b: { c: 1 } }] }, ['a', {}]),
    ).to.throw();
  });
});
