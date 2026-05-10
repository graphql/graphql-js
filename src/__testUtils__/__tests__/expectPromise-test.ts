import { describe, it } from 'node:test';

import { expect } from 'chai';

import { expectPromise } from '../expectPromise.ts';

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

  it('toReject throws if the promise does not reject', async () => {
    try {
      await expectPromise(
        Promise.resolve({}),
      ).toReject(); /* node:coverage disable */
    } /* node:coverage enable */ catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      expect(errorMessage).to.equal(
        "Promise should have rejected, but resolved as '{}'",
      );
    }
  });

  it('toReject returns the rejected reason', async () => {
    const error = new Error('foo');
    expect(await expectPromise(Promise.reject(error)).toReject()).to.equal(
      error,
    );
  });

  it('toRejectWith throws if the promise does not reject', async () => {
    try {
      await expectPromise(Promise.resolve({})).toRejectWith(
        'foo',
      ); /* node:coverage disable */
    } /* node:coverage enable */ catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      expect(errorMessage).to.equal(
        "Promise should have rejected with message 'foo', but resolved as '{}'",
      );
    }
  });

  it('toRejectWith throws if the promise rejects with the wrong reason', async () => {
    try {
      await expectPromise(Promise.reject(new Error('foo'))).toRejectWith(
        'bar',
      ); /* node:coverage disable */
    } /* node:coverage enable */ catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      expect(errorMessage).to.equal(
        "expected Error: foo to have property 'message' of 'bar', but got 'foo'",
      );
    }
  });

  it('toRejectWith does not throw if the promise rejects with the right reason', async () => {
    try {
      await expectPromise(Promise.reject(new Error('foo'))).toRejectWith(
        'foo',
      ); /* node:coverage disable */
    } catch (_err) {
      // Not reached.
      expect.fail('promise threw unexpectedly');
    } /* node:coverage enable */
  });
});
