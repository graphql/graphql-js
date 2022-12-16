/**
 * Async Helper Function that avoids `.then()`
 *
 * It is faster to await a promise prior to returning it from an async function
 * than to return a promise with `.then()`.
 *
 * see: https://github.com/tc39/proposal-faster-promise-adoption
 */
export async function tryAfter<T, U, R = T>(
  promise: Promise<T>,
  onFulfilled: (value: T) => R,
  onError: (error: any) => U,
): Promise<R | U> {
  try {
    return onFulfilled(await promise);
  } catch (error) {
    return onError(error);
  }
}
