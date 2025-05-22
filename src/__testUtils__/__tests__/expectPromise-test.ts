import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectPromise } from '../expectPromise.js';

describe('expectPromise', () => {
  it('throws if passed a value', () => {
    expect(() => expectPromise({})).to.throw(
      "Expected a promise, received '{}'",
    );
  });

  it('toResolve returns the resolved value', async () => {
    const testValue = {};
    const promise = Promise.resolve(testValue);
    expect(await expectPromise(promise).toResolve()).to.equal(testValue);
  });

  it('toRejectWith throws if the promise does not reject', async () => {
    try {
      await expectPromise(Promise.resolve({})).toRejectWith(
        'foo',
      ); /* c8 ignore start */
    } /* c8 ignore stop */ catch (err) {
      expect(err.message).to.equal(
        "Promise should have rejected with message 'foo', but resolved as '{}'",
      );
    }
  });

  it('toRejectWith throws if the promise rejects with the wrong reason', async () => {
    try {
      await expectPromise(Promise.reject(new Error('foo'))).toRejectWith(
        'bar',
      ); /* c8 ignore start */
    } /* c8 ignore stop */ catch (err) {
      expect(err.message).to.equal(
        "expected Error: foo to have property 'message' of 'bar', but got 'foo'",
      );
    }
  });

  it('toRejectWith does not throw if the promise rejects with the right reason', async () => {
    try {
      await expectPromise(Promise.reject(new Error('foo'))).toRejectWith(
        'foo',
      ); /* c8 ignore start */
    } catch (_err) {
      // Not reached.
      expect.fail('promise threw unexpectedly');
    } /* c8 ignore stop */
  });
});
