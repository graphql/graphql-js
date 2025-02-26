import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectPromise } from '../../__testUtils__/expectPromise.js';

import {
  AbortSignalListener,
  cancellableIterable,
  cancellablePromise,
} from '../AbortSignalListener.js';

describe('AbortSignalListener', () => {
  it('works to add a listener', () => {
    const abortController = new AbortController();

    const abortSignalListener = new AbortSignalListener(abortController.signal);

    let called = false;
    const onAbort = () => {
      called = true;
    };
    abortSignalListener.add(onAbort);

    abortController.abort();

    expect(called).to.equal(true);
  });

  it('works to delete a listener', () => {
    const abortController = new AbortController();

    const abortSignalListener = new AbortSignalListener(abortController.signal);

    let called = false;
    /* c8 ignore next 3 */
    const onAbort = () => {
      called = true;
    };
    abortSignalListener.add(onAbort);
    abortSignalListener.delete(onAbort);

    abortController.abort();

    expect(called).to.equal(false);
  });

  it('works to disconnect a listener from the abortSignal', () => {
    const abortController = new AbortController();

    const abortSignalListener = new AbortSignalListener(abortController.signal);

    let called = false;
    /* c8 ignore next 3 */
    const onAbort = () => {
      called = true;
    };
    abortSignalListener.add(onAbort);

    abortSignalListener.disconnect();

    abortController.abort();

    expect(called).to.equal(false);
  });
});

describe('cancellablePromise', () => {
  it('works to cancel an already resolved promise', async () => {
    const abortController = new AbortController();

    const abortSignalListener = new AbortSignalListener(abortController.signal);

    const promise = Promise.resolve(1);

    const withCancellation = cancellablePromise(promise, abortSignalListener);

    abortController.abort(new Error('Cancelled!'));

    await expectPromise(withCancellation).toRejectWith('Cancelled!');
  });

  it('works to cancel an already resolved promise after abort signal triggered', async () => {
    const abortController = new AbortController();
    const abortSignalListener = new AbortSignalListener(abortController.signal);

    abortController.abort(new Error('Cancelled!'));

    const promise = Promise.resolve(1);

    const withCancellation = cancellablePromise(promise, abortSignalListener);

    await expectPromise(withCancellation).toRejectWith('Cancelled!');
  });

  it('works to cancel a hanging promise', async () => {
    const abortController = new AbortController();
    const abortSignalListener = new AbortSignalListener(abortController.signal);

    const promise = new Promise(() => {
      /* never resolves */
    });

    const withCancellation = cancellablePromise(promise, abortSignalListener);

    abortController.abort(new Error('Cancelled!'));

    await expectPromise(withCancellation).toRejectWith('Cancelled!');
  });

  it('works to cancel a hanging promise created after abort signal triggered', async () => {
    const abortController = new AbortController();
    const abortSignalListener = new AbortSignalListener(abortController.signal);

    abortController.abort(new Error('Cancelled!'));

    const promise = new Promise(() => {
      /* never resolves */
    });

    const withCancellation = cancellablePromise(promise, abortSignalListener);

    await expectPromise(withCancellation).toRejectWith('Cancelled!');
  });
});

describe('cancellableAsyncIterable', () => {
  it('works to abort a next call', async () => {
    const abortController = new AbortController();
    const abortSignalListener = new AbortSignalListener(abortController.signal);

    const asyncIterable = {
      [Symbol.asyncIterator]: () => ({
        next: () => Promise.resolve({ value: 1, done: false }),
      }),
    };

    const withCancellation = cancellableIterable(
      asyncIterable,
      abortSignalListener,
    );

    const nextPromise = withCancellation[Symbol.asyncIterator]().next();

    abortController.abort(new Error('Cancelled!'));

    await expectPromise(nextPromise).toRejectWith('Cancelled!');
  });

  it('works to abort a next call when already aborted', async () => {
    const abortController = new AbortController();
    const abortSignalListener = new AbortSignalListener(abortController.signal);

    abortController.abort(new Error('Cancelled!'));

    const asyncIterable = {
      [Symbol.asyncIterator]: () => ({
        next: () => Promise.resolve({ value: 1, done: false }),
      }),
    };

    const withCancellation = cancellableIterable(
      asyncIterable,
      abortSignalListener,
    );

    const nextPromise = withCancellation[Symbol.asyncIterator]().next();

    await expectPromise(nextPromise).toRejectWith('Cancelled!');
  });
});
