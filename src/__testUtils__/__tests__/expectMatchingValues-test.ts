import { describe, it } from 'node:test';

import { expect } from 'chai';

import { expectMatchingValues } from '../expectMatchingValues.ts';

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
