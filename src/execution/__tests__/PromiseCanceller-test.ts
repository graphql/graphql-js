import { describe, it } from 'mocha';

import { expectPromise } from '../../__testUtils__/expectPromise.js';

import { PromiseCanceller } from '../PromiseCanceller.js';

describe('PromiseCanceller', () => {
  it('works to cancel an already resolved promise', async () => {
    const abortController = new AbortController();
    const abortSignal = abortController.signal;

    const promiseCanceller = new PromiseCanceller(abortSignal);

    const promise = Promise.resolve(1);

    const withCancellation = promiseCanceller.withCancellation(promise);

    abortController.abort(new Error('Cancelled!'));

    await expectPromise(withCancellation).toRejectWith('Cancelled!');
  });

  it('works to cancel a hanging promise', async () => {
    const abortController = new AbortController();
    const abortSignal = abortController.signal;

    const promiseCanceller = new PromiseCanceller(abortSignal);

    const promise = new Promise(() => {
      /* never resolves */
    });

    const withCancellation = promiseCanceller.withCancellation(promise);

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

    const withCancellation = promiseCanceller.withCancellation(promise);

    await expectPromise(withCancellation).toRejectWith('Cancelled!');
  });
});
