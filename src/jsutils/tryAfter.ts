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
