import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectEqualPromisesOrValues } from '../../__testUtils__/expectEqualPromisesOrValues.ts';
import { resolveOnNextTick } from '../../__testUtils__/resolveOnNextTick.ts';

import { promiseWithResolvers } from '../../jsutils/promiseWithResolvers.ts';

import { AsyncWorkTracker } from '../AsyncWorkTracker.ts';

describe('AsyncWorkTracker', () => {
  it('works to track promises', async () => {
    const tracker = new AsyncWorkTracker();
    const delayed = promiseWithResolvers<number>();

    tracker.add(delayed.promise);
    expect(tracker.pendingAsyncWork.size).to.equal(1);
    delayed.resolve(1);
    await resolveOnNextTick();
    expect(tracker.pendingAsyncWork.size).to.equal(0);
  });
});

describe('promiseAllTrackOnReject', () => {
  it('resolves like Promise.all', async () => {
    const tracker = new AsyncWorkTracker();

    const values = [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)];

    await expectEqualPromisesOrValues([
      tracker.promiseAllTrackOnReject(values),
      Promise.all(values),
    ]);
  });

  it('resolves synchronous values without tracking', async () => {
    const tracker = new AsyncWorkTracker();

    const result = await tracker.promiseAllTrackOnReject([1, 2, 3]);

    expect(result).to.deep.equal([1, 2, 3]);
    expect(tracker.pendingAsyncWork.size).to.equal(0);
  });

  it('does not add an extra microtask on fulfilled promiseAll results', async () => {
    const tracker = new AsyncWorkTracker();
    let settled = false;

    const promise = Promise.resolve(1);
    const trackedPromise = tracker.promiseAllTrackOnReject([promise]);
    trackedPromise.then(
      () => {
        settled = true;
      },
      () => undefined,
    );
    await Promise.all([promise]);
    expect(settled).to.equal(true);
  });

  it('tracks all promises only after rejection', async () => {
    const delayed = promiseWithResolvers<undefined>();
    const tracker = new AsyncWorkTracker();
    const result = tracker.promiseAllTrackOnReject([
      Promise.reject(new Error('bad')),
      delayed.promise,
    ] as const);
    expect(tracker.pendingAsyncWork.size).to.equal(0);

    await result.catch(() => undefined);
    expect(tracker.pendingAsyncWork.size).to.equal(1);
    delayed.resolve(undefined);

    await resolveOnNextTick();
    expect(tracker.pendingAsyncWork.size).to.equal(0);
  });

  it('tracks promises until they settle and catches later rejections', async () => {
    let unhandledRejection: unknown = null;
    const unhandledRejectionListener = (reason: unknown) => {
      unhandledRejection = reason;
    };
    // eslint-disable-next-line no-undef
    process.on('unhandledRejection', unhandledRejectionListener);

    const tracker = new AsyncWorkTracker();
    const delayed = promiseWithResolvers<undefined>();
    const result = tracker.promiseAllTrackOnReject([
      Promise.reject(new Error('bad')),
      delayed.promise,
    ] as const);

    await result.catch(() => undefined);
    expect(tracker.pendingAsyncWork.size).to.equal(1);

    delayed.reject(new Error('late bad'));
    await new Promise((resolve) => setTimeout(resolve, 20));

    // eslint-disable-next-line no-undef
    process.removeListener('unhandledRejection', unhandledRejectionListener);

    expect(tracker.pendingAsyncWork.size).to.equal(0);
    expect(unhandledRejection).to.equal(null);
  });
});

describe('wait', () => {
  it('returns synchronously when there is no pending async work', () => {
    const tracker = new AsyncWorkTracker();
    expect(tracker.wait()).to.equal(undefined);
  });

  it('waits when tracked async work is present', async () => {
    const tracker = new AsyncWorkTracker();

    const delayed = promiseWithResolvers<undefined>();
    tracker.add(delayed.promise);

    let settled = false;
    const maybeWait = tracker.wait();
    expect(maybeWait).to.be.instanceOf(Promise);
    const wait = Promise.resolve(maybeWait).then(() => {
      settled = true;
    });
    await resolveOnNextTick();
    expect(settled).to.equal(false);

    delayed.resolve(undefined);
    await wait;
    expect(settled).to.equal(true);
  });

  it('keeps waiting when tracked async work is followed by more tracked async work', async () => {
    const tracker = new AsyncWorkTracker();

    const delayed = promiseWithResolvers<undefined>();
    tracker.add(delayed.promise);

    let settled = false;
    const maybeWait = tracker.wait();
    expect(maybeWait).to.be.instanceOf(Promise);
    const wait = Promise.resolve(maybeWait).then(() => {
      settled = true;
    });
    await resolveOnNextTick();
    expect(settled).to.equal(false);

    delayed.resolve(undefined);

    const anotherDelayed = promiseWithResolvers<undefined>();
    tracker.add(anotherDelayed.promise);
    await resolveOnNextTick();
    expect(settled).to.equal(false);

    anotherDelayed.resolve(undefined);

    await wait;
    expect(settled).to.equal(true);
  });

  it('does not wait for side-effect promiseAll tracking added on next microtask', async () => {
    const tracker = new AsyncWorkTracker();
    const delayed = promiseWithResolvers<undefined>();

    tracker
      .promiseAllTrackOnReject([
        Promise.reject(new Error('bad')),
        delayed.promise,
      ])
      .catch(() => undefined);

    const maybeWait = tracker.wait();
    expect(maybeWait).to.equal(undefined);

    await resolveOnNextTick();
    expect(tracker.pendingAsyncWork.size).to.equal(0);
    await resolveOnNextTick();
    expect(tracker.pendingAsyncWork.size).to.be.greaterThan(0);

    delayed.resolve(undefined);
    await Promise.allSettled(Array.from(tracker.pendingAsyncWork));
    await resolveOnNextTick();
    expect(tracker.pendingAsyncWork.size).to.equal(0);
  });
});
