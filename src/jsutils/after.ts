/**
 * Async Helper Function that avoids `.then()`
 *
 * It is faster to await a promise prior to returning it from an async function
 * than to return a promise with `.then()`.
 *
 * see: https://github.com/tc39/proposal-faster-promise-adoption
 */
export async function after<T, R>(
  promise: Promise<T>,
  onFulfilled: (value: T) => R,
): Promise<R> {
  const result = onFulfilled(await promise);
  return result;
}
