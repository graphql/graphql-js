import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectEqualPromisesOrValues } from '../expectEqualPromisesOrValues.js';
import { expectPromise } from '../expectPromise.js';

describe('expectEqualPromisesOrValues', () => {
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

  it('does not throw when given equal promises', async () => {
    const testValue = Promise.resolve({ test: 'test' });

    await expectPromise(
      expectEqualPromisesOrValues([testValue, testValue, testValue]),
    ).toResolve();
  });

  it('throws when given unequal promises', async () => {
    await expectPromise(
      expectEqualPromisesOrValues([
        Promise.resolve({}),
        Promise.resolve({}),
        Promise.resolve({ test: 'test' }),
      ]),
    ).toRejectWith("expected { test: 'test' } to deeply equal {}");
  });

  it('throws when given equal values that are mixtures of values and promises', () => {
    const testValue = { test: 'test' };
    expect(() =>
      expectEqualPromisesOrValues([testValue, Promise.resolve(testValue)]),
    ).to.throw('Received an invalid mixture of promises and values.');
  });
});
