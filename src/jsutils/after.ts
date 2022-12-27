import { isPromise } from './isPromise.js';
import type { PromiseOrValue } from './PromiseOrValue.js';

/**
 * Async Helper Function that avoids `.then()`
 *
 * It is faster to await a promise prior to returning it from an async function
 * than to return a promise with `.then()`.
 *
 * see: https://github.com/tc39/proposal-faster-promise-adoption
 */
export async function after<T, R = T, U = T>(
  promise: Promise<T>,
  onFulfilled?: (value: T) => PromiseOrValue<R>,
  onError?: (error: any) => U,
): Promise<R | U> {
  try {
    if (onFulfilled === undefined) {
      return (await promise) as R;
    }

    const result = onFulfilled(await promise);

    if (isPromise(result)) {
      return await result;
    }

    return result;
  } catch (error) {
    if (onError === undefined) {
      throw error;
    }
    return onError(error);
  }
}
