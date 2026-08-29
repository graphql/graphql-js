import { describe, it } from 'node:test';

import { assert, expect } from 'chai';

import { expectPromise } from '../../../__testUtils__/expectPromise.ts';
import { resolveOnNextTick } from '../../../__testUtils__/resolveOnNextTick.ts';

import { promiseWithResolvers } from '../../../jsutils/promiseWithResolvers.ts';

import { completeBatchWork } from '../completeBatchWork.ts';
import type { BatchExecutor } from '../types.ts';

describe('completeBatchWork', () => {
  it('ignores late settlement from abandoned work while unrelated work remains active', async () => {
    const trigger = promiseWithResolvers<undefined>();
    const abandonedFulfillment = promiseWithResolvers<undefined>();
    const abandonedRejection = promiseWithResolvers<undefined>();
    const active = promiseWithResolvers<undefined>();
    const errors: Array<unknown> = [];
    const trackedPromises: Array<unknown> = [];
    let abandoned = false;

    const executor = {
      collectedErrors: { errors },
      getAsyncHelpers: () => ({
        track: (promises: ReadonlyArray<unknown>) => {
          trackedPromises.push(...promises);
        },
      }),
    } as unknown as BatchExecutor<undefined>;
    const result = completeBatchWork(executor, [
      { promise: trigger.promise, isActive: () => true },
      {
        promise: abandonedFulfillment.promise,
        isActive: () => !abandoned,
      },
      {
        promise: abandonedRejection.promise,
        isActive: () => !abandoned,
      },
      { promise: active.promise, isActive: () => true },
    ]);
    assert(result instanceof Promise);
    let settled = false;
    result.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    abandoned = true;
    errors.push(new Error('ancestor was nulled'));
    trigger.resolve(undefined);
    await resolveOnNextTick();
    expect(trackedPromises).to.have.members([
      abandonedFulfillment.promise,
      abandonedRejection.promise,
    ]);

    abandonedFulfillment.resolve(undefined);
    abandonedRejection.reject(new Error('late abandoned rejection'));
    await resolveOnNextTick();
    expect(settled).to.equal(false);

    active.resolve(undefined);
    await result;
    expect(settled).to.equal(true);
  });

  it('tracks remaining work when live work rejects', async () => {
    const rejected = promiseWithResolvers<undefined>();
    const remaining = promiseWithResolvers<undefined>();
    const trackedPromises: Array<unknown> = [];
    const executor = {
      collectedErrors: { errors: [] },
      getAsyncHelpers: () => ({
        track: (promises: ReadonlyArray<unknown>) => {
          trackedPromises.push(...promises);
        },
      }),
    } as unknown as BatchExecutor<undefined>;
    const result = completeBatchWork(executor, [
      { promise: rejected.promise, isActive: () => true },
      { promise: remaining.promise, isActive: () => true },
    ]);
    const error = new Error('live rejection');

    rejected.reject(error);

    expect(await expectPromise(result).toReject()).to.equal(error);
    expect(trackedPromises).to.deep.equal([remaining.promise]);

    remaining.reject(new Error('late rejection'));
    await resolveOnNextTick();
  });
});
