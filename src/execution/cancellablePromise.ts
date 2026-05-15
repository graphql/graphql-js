import { promiseWithResolvers } from '../jsutils/promiseWithResolvers.ts';

/** @internal */
export interface CancellablePromise<T> {
  promise: Promise<T>;
  abort: (reason?: unknown) => void;
}

/** @internal */
export function withCancellation<T>(
  originalPromise: Promise<T>,
): CancellablePromise<T> {
  const { promise, resolve, reject } = promiseWithResolvers<T>();
  let settled = false;

  const settleResolve = (value: T): void => {
    if (settled) {
      return;
    }
    settled = true;
    resolve(value);
  };
  const settleReject = (error: unknown): void => {
    if (settled) {
      return;
    }
    settled = true;
    reject(error);
  };

  originalPromise.then(settleResolve, settleReject);

  return {
    promise,
    abort(reason?: unknown): void {
      settleReject(reason);
    },
  };
}

/** @internal */
export function cancellablePromise<T>(
  promise: Promise<T>,
  abortSignal: AbortSignal,
): Promise<T> {
  const withAbort = withCancellation(promise);

  if (abortSignal.aborted) {
    withAbort.abort(abortSignal.reason);
    return withAbort.promise;
  }

  const onAbort = () => {
    abortSignal.removeEventListener('abort', onAbort);
    withAbort.abort(abortSignal.reason);
  };
  abortSignal.addEventListener('abort', onAbort);

  withAbort.promise.then(
    () => {
      abortSignal.removeEventListener('abort', onAbort);
    },
    () => {
      abortSignal.removeEventListener('abort', onAbort);
    },
  );

  return withAbort.promise;
}
