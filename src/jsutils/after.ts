import { isPromise } from './isPromise.js';
import type { PromiseOrValue } from './PromiseOrValue.js';

/**
 * Async Helper Function that avoides `.then()`
 *
 * It is faster to await a promise prior to returning it from an async function
 * than to return a promise with `.then()`.
 *
 * see: https://github.com/tc39/proposal-faster-promise-adoption
 */
export async function after<T, R>(
  promise: Promise<T>,
  onFulfilled: (value: T) => PromiseOrValue<R>,
): Promise<R> {
  const result = onFulfilled(await promise);
  if (isPromise(result)) {
    return await result;
  }
  return result;
}
