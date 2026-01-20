import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectPromise } from '../../__testUtils__/expectPromise.js';

import { cancellablePromise } from '../cancellablePromise.js';

describe('cancellablePromise', () => {
  it('works to wrap a resolved promise', async () => {
    const abortController = new AbortController();

    const promise = Promise.resolve(1);

    const withCancellation = cancellablePromise(
      promise,
      abortController.signal,
    );

    expect(await withCancellation).to.equal(1);
  });

  it('works to wrap a rejected promise', async () => {
    const abortController = new AbortController();

    const promise = Promise.reject(new Error('Rejected!'));

    const withCancellation = cancellablePromise(
      promise,
      abortController.signal,
    );

    await expectPromise(withCancellation).toRejectWith('Rejected!');
  });

  it('works to cancel an already resolved promise', async () => {
    const abortController = new AbortController();

    const promise = Promise.resolve(1);

    const withCancellation = cancellablePromise(
      promise,
      abortController.signal,
    );

    abortController.abort(new Error('Cancelled!'));

    await expectPromise(withCancellation).toRejectWith('Cancelled!');
  });

  it('works to cancel an already resolved promise after abort signal triggered', async () => {
    const abortController = new AbortController();

    abortController.abort(new Error('Cancelled!'));

    const promise = Promise.resolve(1);

    const withCancellation = cancellablePromise(
      promise,
      abortController.signal,
    );

    await expectPromise(withCancellation).toRejectWith('Cancelled!');
  });

  it('works to cancel an already rejected promise after abort signal triggered', async () => {
    const abortController = new AbortController();

    abortController.abort(new Error('Cancelled!'));

    const promise = Promise.reject(new Error('Rejected!'));

    const withCancellation = cancellablePromise(
      promise,
      abortController.signal,
    );

    await expectPromise(withCancellation).toRejectWith('Cancelled!');
  });

  it('works to cancel a hanging promise', async () => {
    const abortController = new AbortController();

    const promise = new Promise(() => {
      /* never resolves */
    });

    const withCancellation = cancellablePromise(
      promise,
      abortController.signal,
    );

    abortController.abort(new Error('Cancelled!'));

    await expectPromise(withCancellation).toRejectWith('Cancelled!');
  });

  it('works to cancel a hanging promise created after abort signal triggered', async () => {
    const abortController = new AbortController();

    abortController.abort(new Error('Cancelled!'));

    const promise = new Promise(() => {
      /* never resolves */
    });

    const withCancellation = cancellablePromise(
      promise,
      abortController.signal,
    );

    await expectPromise(withCancellation).toRejectWith('Cancelled!');
  });
});
