import { describe, it } from 'node:test';

import { expect } from 'chai';

import {
  expectMatchingErrors,
  expectMatchingValues,
} from '../expectMatchingValues.ts';

describe('expectMatchingValues', () => {
  it('throws when given unequal values', () => {
    expect(() =>
      expectMatchingValues([() => ({}), () => ({}), () => ({ test: 'test' })]),
    ).throw("expected { test: 'test' } to deeply equal {}");
  });

  it('does not throw when given equal values', () => {
    const testValue = { test: 'test' };
    expect(() =>
      expectMatchingValues([() => testValue, () => testValue, () => testValue]),
    ).not.to.throw();
  });

  it('rethrows when given matching thrown errors', () => {
    expect(() =>
      expectMatchingValues([
        () => {
          throw new Error('test error');
        },
        () => {
          throw new Error('test error');
        },
      ]),
    ).to.throw('test error');
  });

  it('throws when given different thrown errors', () => {
    expect(() =>
      expectMatchingValues([
        () => {
          throw new Error('test error');
        },
        () => {
          throw new Error('different error');
        },
      ]),
    ).to.throw(/deeply equal/);
  });

  it('does not throw when given matching non-error values as errors', () => {
    expect(() =>
      expectMatchingErrors(['test error', 'test error']),
    ).not.to.throw();
  });

  it('throws when given a mixture of values and thrown errors', () => {
    expect(() =>
      expectMatchingValues([
        () => ({ test: 'test' }),
        () => {
          throw new Error('test error');
        },
      ]),
    ).to.throw('Received an invalid mixture of values and thrown errors.');
  });
});
