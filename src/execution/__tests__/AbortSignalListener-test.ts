import { describe, it } from 'mocha';

import { expectPromise } from '../../__testUtils__/expectPromise.js';

import { PromiseCanceller } from '../AbortSignalListener.js';

describe('PromiseCanceller', () => {
  describe('cancellablePromise', () => {
    it('works to cancel an already resolved promise', async () => {
      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      const promiseCanceller = new PromiseCanceller(abortSignal);

      const promise = Promise.resolve(1);

      const withCancellation = promiseCanceller.cancellablePromise(promise);

      abortController.abort(new Error('Cancelled!'));

      await expectPromise(withCancellation).toRejectWith('Cancelled!');
    });

    it('works to cancel an already resolved promise after abort signal triggered', async () => {
      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      abortController.abort(new Error('Cancelled!'));

      const promiseCanceller = new PromiseCanceller(abortSignal);

      const promise = Promise.resolve(1);

      const withCancellation = promiseCanceller.cancellablePromise(promise);

      await expectPromise(withCancellation).toRejectWith('Cancelled!');
    });

    it('works to cancel a hanging promise', async () => {
      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      const promiseCanceller = new PromiseCanceller(abortSignal);

      const promise = new Promise(() => {
        /* never resolves */
      });

      const withCancellation = promiseCanceller.cancellablePromise(promise);

      abortController.abort(new Error('Cancelled!'));

      await expectPromise(withCancellation).toRejectWith('Cancelled!');
    });

    it('works to cancel a hanging promise created after abort signal triggered', async () => {
      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      abortController.abort(new Error('Cancelled!'));

      const promiseCanceller = new PromiseCanceller(abortSignal);

      const promise = new Promise(() => {
        /* never resolves */
      });

      const withCancellation = promiseCanceller.cancellablePromise(promise);

      await expectPromise(withCancellation).toRejectWith('Cancelled!');
    });
  });

  describe('cancellableAsyncIterable', () => {
    it('works to abort a next call', async () => {
      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      const promiseCanceller = new PromiseCanceller(abortSignal);

      const asyncIterable = {
        [Symbol.asyncIterator]: () => ({
          next: () => Promise.resolve({ value: 1, done: false }),
        }),
      };

      const cancellableAsyncIterable =
        promiseCanceller.cancellableIterable(asyncIterable);

      const nextPromise =
        cancellableAsyncIterable[Symbol.asyncIterator]().next();

      abortController.abort(new Error('Cancelled!'));

      await expectPromise(nextPromise).toRejectWith('Cancelled!');
    });

    it('works to abort a next call when already aborted', async () => {
      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      abortController.abort(new Error('Cancelled!'));

      const promiseCanceller = new PromiseCanceller(abortSignal);

      const asyncIterable = {
        [Symbol.asyncIterator]: () => ({
          next: () => Promise.resolve({ value: 1, done: false }),
        }),
      };

      const cancellableAsyncIterable =
        promiseCanceller.cancellableIterable(asyncIterable);

      const nextPromise =
        cancellableAsyncIterable[Symbol.asyncIterator]().next();

      await expectPromise(nextPromise).toRejectWith('Cancelled!');
    });
  });
});
