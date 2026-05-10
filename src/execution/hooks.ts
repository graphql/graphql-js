import type { SharedExecutionContext } from './createSharedExecutionContext.ts';
import type { ValidatedExecutionArgs } from './Executor.ts';

export interface AsyncWorkFinishedInfo {
  validatedExecutionArgs: ValidatedExecutionArgs;
}

export interface ExecutionHooks {
  asyncWorkFinished?: (info: AsyncWorkFinishedInfo) => void;
}

function runHookSafely<TInfo>(hook: (info: TInfo) => void, info: TInfo): void {
  try {
    hook?.(info);
  } catch {
    // ignore hook errors
  }
}

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
