import { describe, it } from 'node:test';

import { assert, expect } from 'chai';

import { expectPromise } from '../../../__testUtils__/expectPromise.ts';
import { resolveOnNextTick } from '../../../__testUtils__/resolveOnNextTick.ts';

import { promiseWithResolvers } from '../../../jsutils/promiseWithResolvers.ts';

import type { BatchCompletion } from '../batchCompletion.ts';
import {
  batchCompletionFromPromise,
  combineBatchCompletions,
} from '../batchCompletion.ts';
import type { BatchExecutor } from '../types.ts';

describe('batch completions', () => {
  it('finishes when a promised batch needs no further asynchronous completion', async () => {
    const promisedCompletion = promiseWithResolvers<
      BatchCompletion | undefined
    >();
    const completion = batchCompletionFromPromise(
      promisedCompletion.promise,
      () => true,
    );
    expect(completion.isNeededForResponse()).to.equal(true);

    promisedCompletion.resolve(undefined);
    await completion.promise;

    expect(completion.isNeededForResponse()).to.equal(false);
  });

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
    const completion = combineBatchCompletions(executor, [
      { promise: trigger.promise, isNeededForResponse: () => true },
      {
        promise: abandonedFulfillment.promise,
        isNeededForResponse: () => !abandoned,
      },
      {
        promise: abandonedRejection.promise,
        isNeededForResponse: () => !abandoned,
      },
      { promise: active.promise, isNeededForResponse: () => true },
    ]);
    const result = completion?.promise;
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
    const completion = combineBatchCompletions(executor, [
      { promise: rejected.promise, isNeededForResponse: () => true },
      { promise: remaining.promise, isNeededForResponse: () => true },
    ]);
    const result = completion?.promise;
    const error = new Error('live rejection');

    rejected.reject(error);

    expect(await expectPromise(result).toReject()).to.equal(error);
    expect(trackedPromises).to.deep.equal([remaining.promise]);

    remaining.reject(new Error('late rejection'));
    await resolveOnNextTick();
  });

  it('propagates nested failures while reevaluating response dependencies', async () => {
    const trigger = promiseWithResolvers<undefined>();
    const fatal = promiseWithResolvers<undefined>();
    const errors: Array<unknown> = [];
    const trackedPromises: Array<unknown> = [];
    const executor = {
      collectedErrors: { errors },
      getAsyncHelpers: () => ({
        track: (promises: ReadonlyArray<unknown>) => {
          trackedPromises.push(...promises);
        },
      }),
    } as unknown as BatchExecutor<undefined>;
    const innerCompletion = combineBatchCompletions(executor, [
      { promise: fatal.promise, isNeededForResponse: () => true },
    ]);
    assert(innerCompletion !== undefined);
    const triggerPromise = trigger.promise.then(() => {
      errors.push(new Error('sibling nulled a path'));
    });
    const outerCompletion = combineBatchCompletions(executor, [
      { promise: triggerPromise, isNeededForResponse: () => true },
      innerCompletion,
    ]);
    assert(outerCompletion !== undefined);
    const fatalError = new Error('nested fatal rejection');

    trigger.resolve(undefined);
    fatal.reject(fatalError);

    expect(await expectPromise(outerCompletion.promise).toReject()).to.equal(
      fatalError,
    );
    expect(trackedPromises).to.deep.equal([]);
  });

  it('propagates promised completion failures while reevaluating response dependencies', async () => {
    const trigger = promiseWithResolvers<undefined>();
    const promisedCompletion = promiseWithResolvers<
      BatchCompletion | undefined
    >();
    const errors: Array<unknown> = [];
    const trackedPromises: Array<unknown> = [];
    const executor = {
      collectedErrors: { errors },
      getAsyncHelpers: () => ({
        track: (promises: ReadonlyArray<unknown>) => {
          trackedPromises.push(...promises);
        },
      }),
    } as unknown as BatchExecutor<undefined>;
    const completion = batchCompletionFromPromise(
      promisedCompletion.promise,
      () => true,
    );
    const triggerPromise = trigger.promise.then(() => {
      errors.push(new Error('sibling nulled a path'));
    });
    const outerCompletion = combineBatchCompletions(executor, [
      { promise: triggerPromise, isNeededForResponse: () => true },
      completion,
    ]);
    assert(outerCompletion !== undefined);
    const fatalError = new Error('promised completion fatal rejection');

    trigger.resolve(undefined);
    promisedCompletion.reject(fatalError);

    expect(await expectPromise(outerCompletion.promise).toReject()).to.equal(
      fatalError,
    );
    expect(trackedPromises).to.deep.equal([]);
  });
});
