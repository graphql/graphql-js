/** @category Execution */

import type { SharedExecutionContext } from './createSharedExecutionContext.ts';
import type { ValidatedExecutionArgs } from './Executor.ts';

/** Information passed to hooks after asynchronous execution work has finished. */
export interface AsyncWorkFinishedInfo {
  /** Validated execution arguments for the operation that finished async work. */
  validatedExecutionArgs: ValidatedExecutionArgs;
}

/** Optional hooks invoked during GraphQL execution. */
export interface ExecutionHooks {
  /** Called after all tracked asynchronous execution work has settled. */
  asyncWorkFinished?: (info: AsyncWorkFinishedInfo) => void;
}

function runHookSafely<TInfo>(hook: (info: TInfo) => void, info: TInfo): void {
  try {
    hook?.(info);
  } catch {
    // ignore hook errors
  }
}

/** @internal */
export function runAsyncWorkFinishedHook(
  validatedExecutionArgs: ValidatedExecutionArgs,
  sharedExecutionContext: SharedExecutionContext,
  asyncWorkFinishedHook: (info: AsyncWorkFinishedInfo) => void,
): void {
  const maybeWaitForAsyncWork = sharedExecutionContext.asyncWorkTracker.wait();
  if (maybeWaitForAsyncWork === undefined) {
    runHookSafely(asyncWorkFinishedHook, { validatedExecutionArgs });
    return;
  }
  maybeWaitForAsyncWork
    .then(() => {
      runHookSafely(asyncWorkFinishedHook, { validatedExecutionArgs });
    })
    .catch(() => undefined);
}
