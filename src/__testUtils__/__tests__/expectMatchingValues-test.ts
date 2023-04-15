import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectMatchingValues } from '../expectMatchingValues.js';

describe('expectMatchingValues', () => {
  it('throws when given unequal values', () => {
    expect(() => expectMatchingValues([{}, {}, { test: 'test' }])).throw(
      "expected { test: 'test' } to deeply equal {}",
    );
  });

  it('does not throw when given equal values', () => {
    const testValue = { test: 'test' };
    expect(() =>
      expectMatchingValues([testValue, testValue, testValue]),
    ).not.to.throw();
  });
});
