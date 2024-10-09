import { expect } from 'chai';
import { describe, it } from 'mocha';

import { instanceOf } from '../instanceOf.js';

describe('instanceOf', () => {
  it('do not throw on values without prototype', () => {
    class Foo {
      get [Symbol.toStringTag]() {
        /* c8 ignore next 2 */
        return 'Foo';
      }
    }

    expect(instanceOf(true, Foo)).to.equal(false);
    expect(instanceOf(null, Foo)).to.equal(false);
    expect(instanceOf(Object.create(null), Foo)).to.equal(false);
  });
});
