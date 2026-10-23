import { promiseWithResolvers } from '../../jsutils/promiseWithResolvers.ts';

import type { BatchExecutor } from './types.ts';

/**
 * An asynchronous completion and whether the response still depends on it.
 * Null propagation can make a completion unnecessary before its promise settles.
 * Such work stops delaying the response but remains tracked for async cleanup.
 * @internal
 */
export interface BatchCompletion {
  /** Settles when this completion finishes or fails. */
  promise: Promise<void>;
  /** Updates nested completions and checks whether the response needs this one. */
  isNeededForResponse: () => boolean;
}

/**
 * Combines completions, waiting only for those the response still needs.
 * Returns undefined when no asynchronous completion is needed.
 * @internal
 */
export function combineBatchCompletions<TPositionContext>(
  executor: BatchExecutor<TPositionContext>,
  completions: ReadonlyArray<BatchCompletion>,
): BatchCompletion | undefined {
  const pendingCompletions = new Set(completions);
  releaseUnneededCompletions(executor, pendingCompletions);
  if (pendingCompletions.size === 0) {
    return;
  }
  let errorCount = executor.collectedErrors.errors.length;
  let failed = false;
  const { promise, resolve, reject } = promiseWithResolvers<undefined>();

  const resolveIfComplete = () => {
    if (pendingCompletions.size === 0) {
      resolve(undefined);
    }
  };

  pendingCompletions.forEach((completion) => {
    completion.promise.then(
      () => {
        if (!pendingCompletions.delete(completion)) {
          return;
        }
        const nextErrorCount = executor.collectedErrors.errors.length;
        if (nextErrorCount !== errorCount) {
          errorCount = nextErrorCount;
          releaseUnneededCompletions(executor, pendingCompletions);
        }
        resolveIfComplete();
      },
      (error: unknown) => {
        if (!pendingCompletions.delete(completion)) {
          return;
        }
        failed = true;
        const remainingPromises = Array.from(
          pendingCompletions,
          (remaining) => remaining.promise,
        );
        pendingCompletions.clear();
        executor.getAsyncHelpers().track(remainingPromises);
        reject(error);
      },
    );
  });

  return {
    promise,
    isNeededForResponse: () => {
      releaseUnneededCompletions(executor, pendingCompletions);
      resolveIfComplete();
      // A failure must remain needed until the waiting parent observes it.
      return failed || pendingCompletions.size !== 0;
    },
  };
}

/**
 * Returns a completion handle immediately for a promise that produces one later.
 * Its promise waits for both the promised handle and that handle's completion.
 * Before the handle arrives, isNeededWhilePending checks the source fields.
 * @internal
 */
export function batchCompletionFromPromise(
  promisedCompletion: Promise<BatchCompletion | undefined>,
  isNeededWhilePending: () => boolean,
): BatchCompletion {
  let resolvedCompletion: BatchCompletion | undefined;
  let state: 'pending' | 'fulfilled' | 'rejected' = 'pending';
  const promise = promisedCompletion.then(
    (completion) => {
      state = 'fulfilled';
      resolvedCompletion = completion;
      return completion?.promise;
    },
    (error: unknown) => {
      state = 'rejected';
      throw error;
    },
  );

  return {
    promise,
    isNeededForResponse: () => {
      if (state === 'rejected') {
        return true;
      }
      if (state === 'pending') {
        return isNeededWhilePending();
      }
      return resolvedCompletion?.isNeededForResponse() ?? false;
    },
  };
}

function releaseUnneededCompletions<TPositionContext>(
  executor: BatchExecutor<TPositionContext>,
  pendingCompletions: Set<BatchCompletion>,
): void {
  const unneededPromises: Array<Promise<void>> = [];
  for (const completion of pendingCompletions) {
    if (!completion.isNeededForResponse()) {
      pendingCompletions.delete(completion);
      unneededPromises.push(completion.promise);
    }
  }
  if (unneededPromises.length !== 0) {
    executor.getAsyncHelpers().track(unneededPromises);
  }
}
