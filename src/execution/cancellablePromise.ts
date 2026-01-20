import { promiseWithResolvers } from '../jsutils/promiseWithResolvers.js';

export function cancellablePromise<T>(
  originalPromise: Promise<T>,
  abortSignal: AbortSignal,
): Promise<T> {
  if (abortSignal.aborted) {
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    return Promise.reject(abortSignal.reason);
  }

  const { promise, resolve, reject } = promiseWithResolvers<T>();
  const onAbort = () => reject(abortSignal.reason);
  abortSignal.addEventListener('abort', onAbort);
  originalPromise.then(
    (resolved) => {
      abortSignal.removeEventListener('abort', onAbort);
      resolve(resolved);
    },
    (error: unknown) => {
      abortSignal.removeEventListener('abort', onAbort);
      reject(error);
    },
  );

  return promise;
}
