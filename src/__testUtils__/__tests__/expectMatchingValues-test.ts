import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectEqualPromisesOrValues } from '../expectEqualPromisesOrValues.js';

describe('expectMatchingValues', () => {
  it('throws when given unequal values', () => {
    expect(() => expectEqualPromisesOrValues([{}, {}, { test: 'test' }])).throw(
      "expected { test: 'test' } to deeply equal {}",
    );
  });

  it('does not throw when given equal values', () => {
    const testValue = { test: 'test' };
    expect(() =>
      expectEqualPromisesOrValues([testValue, testValue, testValue]),
    ).not.to.throw();
  });
});
