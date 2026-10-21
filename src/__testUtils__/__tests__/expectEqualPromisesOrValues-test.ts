import { describe, it } from 'node:test';

import { expect } from 'chai';

import { expectEqualPromisesOrValues } from '../expectEqualPromisesOrValues.ts';
import { expectPromise } from '../expectPromise.ts';

describe('expectEqualPromisesOrValues', () => {
  it('throws when given unequal values', () => {
    expect(() =>
      expectEqualPromisesOrValues([
        () => ({}),
        () => ({}),
        () => ({ test: 'test' }),
      ]),
    ).throw("expected { test: 'test' } to deeply equal {}");
  });

  it('does not throw when given equal values', () => {
    const testValue = { test: 'test' };
    expect(() =>
      expectEqualPromisesOrValues([
        () => testValue,
        () => testValue,
        () => testValue,
      ]),
    ).not.to.throw();
  });

  it('does not throw when given equal promises', async (): Promise<void> => {
    await expectPromise(
      expectEqualPromisesOrValues([
        () => Promise.resolve({ test: 'test' }),
        () => Promise.resolve({ test: 'test' }),
        () => Promise.resolve({ test: 'test' }),
      ]),
    ).toResolve();
  });

  it('throws when given unequal promises', async () => {
    await expectPromise(
      expectEqualPromisesOrValues([
        () => Promise.resolve({}),
        () => Promise.resolve({}),
        () => Promise.resolve({ test: 'test' }),
      ]),
    ).toRejectWith("expected { test: 'test' } to deeply equal {}");
  });

  it('rejects when given matching rejected promises', async () => {
    await expectPromise(
      expectEqualPromisesOrValues([
        () => Promise.reject(new Error('test error')),
        () => Promise.reject(new Error('test error')),
      ]),
    ).toRejectWith('test error');
  });

  it('rejects when given different rejected promises', async () => {
    const error = await expectPromise(
      expectEqualPromisesOrValues([
        () => Promise.reject(new Error('test error')),
        () => Promise.reject(new Error('different error')),
      ]),
    ).toReject();

    expect(error).to.be.an.instanceOf(Error);
    expect(error).to.have.property('message').that.contains('deeply equal');
  });

  it('rejects when matching errors mix throws and promises', async () => {
    await expectPromise(
      expectEqualPromisesOrValues([
        () => Promise.reject(new Error('test error')),
        () => {
          throw new Error('test error');
        },
      ]),
    ).toRejectWith('test error');
  });

  it('rejects when mixed throws and promises produce different errors', async () => {
    const error = await expectPromise(
      expectEqualPromisesOrValues([
        () => Promise.reject(new Error('test error')),
        () => {
          throw new Error('different error');
        },
      ]),
    ).toReject();

    expect(error).to.be.an.instanceOf(Error);
    expect(error).to.have.property('message').that.contains('deeply equal');
  });

  it('rejects when thrown errors are mixed with resolved promises', async () => {
    await expectPromise(
      expectEqualPromisesOrValues([
        () => Promise.resolve({ test: 'test' }),
        () => {
          throw new Error('test error');
        },
      ]),
    ).toRejectWith('Received an invalid mixture of values and thrown errors.');
  });

  it('throws when given matching throwing functions', () => {
    expect(() =>
      expectEqualPromisesOrValues([
        () => {
          throw new Error('test error');
        },
        () => {
          throw new Error('test error');
        },
      ]),
    ).to.throw('test error');
  });

  it('throws when given a mixture of thrown errors and values', () => {
    expect(() =>
      expectEqualPromisesOrValues([
        () => {
          throw new Error('test error');
        },
        () => ({ test: 'test' }),
      ]),
    ).to.throw('Received an invalid mixture of thrown errors and values.');
  });

  it('throws when given equal values that are mixtures of values and promises', () => {
    const testValue = { test: 'test' };
    expect(() =>
      expectEqualPromisesOrValues([
        () => testValue,
        () => Promise.resolve(testValue),
      ]),
    ).to.throw('Received an invalid mixture of promises and values.');
  });

  it('throws when the first item is a promise and later items are values', () => {
    const testValue = { test: 'test' };
    expect(() =>
      expectEqualPromisesOrValues([
        () => Promise.resolve(testValue),
        () => testValue,
      ]),
    ).to.throw('Received an invalid mixture of promises and values.');
  });
});
