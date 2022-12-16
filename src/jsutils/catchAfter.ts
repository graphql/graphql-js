/**
 * Async Helper Function that avoides `.then()`
 *
 * It is faster to await a promise prior to returning it from an async function
 * than to return a promise with `.then()`.
 *
 * see: https://github.com/tc39/proposal-faster-promise-adoption
 */
export async function catchAfter<T, U>(
  promise: Promise<T>,
  onError: (error: any) => U,
): Promise<T | U> {
  try {
    return await promise;
  } catch (error) {
    return onError(error);
  }
}
