import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectPromise } from '../../__testUtils__/expectPromise.ts';

import { promiseWithResolvers } from '../../jsutils/promiseWithResolvers.ts';

import { cancellablePromise, withCancellation } from '../cancellablePromise.ts';

describe('withCancellation', () => {
  it('works to wrap a resolved promise', async () => {
    const promise = Promise.resolve(1);
    const withAbort = withCancellation(promise);
    expect(await withAbort.promise).to.equal(1);
  });

  it('works to wrap a rejected promise', async () => {
    const promise = Promise.reject(new Error('Rejected!'));
    const withAbort = withCancellation(promise);
    await expectPromise(withAbort.promise).toRejectWith('Rejected!');
  });

  it('works to abort an already resolved promise', async () => {
    const promise = Promise.resolve(1);
    const withAbort = withCancellation(promise);

    withAbort.abort(new Error('Cancelled!'));
    await expectPromise(withAbort.promise).toRejectWith('Cancelled!');
  });

  it('works to abort a hanging promise', async () => {
    const promise = new Promise(() => {
      /* never resolves */
    });
    const withAbort = withCancellation(promise);

    withAbort.abort(new Error('Cancelled!'));
    await expectPromise(withAbort.promise).toRejectWith('Cancelled!');
  });

  it('does nothing when aborting an already settled promise', async () => {
    const promise = Promise.resolve(1);
    const withAbort = withCancellation(promise);

    expect(await withAbort.promise).to.equal(1);
    withAbort.abort(new Error('Cancelled!'));
    expect(await withAbort.promise).to.equal(1);
  });

  it('handles later original rejections when already aborted', async () => {
    const deferred = promiseWithResolvers<undefined>();

    let unhandledRejection: unknown = null;
    const unhandledRejectionListener = (reason: unknown) => {
      unhandledRejection = reason;
    };
    // eslint-disable-next-line no-undef
    process.on('unhandledRejection', unhandledRejectionListener);

    try {
      const withAbort = withCancellation(deferred.promise);
      withAbort.abort(new Error('Cancelled!'));
      await expectPromise(withAbort.promise).toRejectWith('Cancelled!');

      deferred.reject(new Error('Rejected later'));
      await new Promise((resolve) => setTimeout(resolve, 20));
    } finally {
      // eslint-disable-next-line no-undef
      process.removeListener('unhandledRejection', unhandledRejectionListener);
    }

    expect(unhandledRejection).to.equal(null);
  });
});

describe('cancellablePromise', () => {
  it('works to wrap a resolved promise', async () => {
    const abortController = new AbortController();
    const cancelledPromise = cancellablePromise(
      Promise.resolve(1),
      abortController.signal,
    );
    expect(await cancelledPromise).to.equal(1);
  });

  it('works to wrap a rejected promise', async () => {
    const abortController = new AbortController();
    const cancelledPromise = cancellablePromise(
      Promise.reject(new Error('Rejected!')),
      abortController.signal,
    );
    await expectPromise(cancelledPromise).toRejectWith('Rejected!');
  });

  it('rejects immediately when signal is already aborted', async () => {
    const abortController = new AbortController();
    abortController.abort(new Error('Cancelled!'));

    const cancelledPromise = cancellablePromise(
      new Promise(() => {
        /* never resolves */
      }),
      abortController.signal,
    );

    await expectPromise(cancelledPromise).toRejectWith('Cancelled!');
  });

  it('works to abort a hanging promise', async () => {
    const abortController = new AbortController();
    const cancelledPromise = cancellablePromise(
      new Promise(() => {
        /* never resolves */
      }),
      abortController.signal,
    );

    abortController.abort(new Error('Cancelled!'));
    await expectPromise(cancelledPromise).toRejectWith('Cancelled!');
  });

  it('does nothing when aborting an already settled promise', async () => {
    const abortController = new AbortController();
    const cancelledPromise = cancellablePromise(
      Promise.resolve(1),
      abortController.signal,
    );

    expect(await cancelledPromise).to.equal(1);
    abortController.abort(new Error('Cancelled!'));
    expect(await cancelledPromise).to.equal(1);
  });

  it('handles later original rejections when already aborted', async () => {
    const deferred = promiseWithResolvers<undefined>();
    const abortController = new AbortController();

    let unhandledRejection: unknown = null;
    const unhandledRejectionListener = (reason: unknown) => {
      unhandledRejection = reason;
    };
    // eslint-disable-next-line no-undef
    process.on('unhandledRejection', unhandledRejectionListener);

    try {
      const cancelledPromise = cancellablePromise(
        deferred.promise,
        abortController.signal,
      );
      abortController.abort(new Error('Cancelled!'));
      await expectPromise(cancelledPromise).toRejectWith('Cancelled!');

      deferred.reject(new Error('Rejected later'));
      await new Promise((resolve) => setTimeout(resolve, 20));
    } finally {
      // eslint-disable-next-line no-undef
      process.removeListener('unhandledRejection', unhandledRejectionListener);
    }

    expect(unhandledRejection).to.equal(null);
  });
});
