/**
 * Returns true if the value acts like a Promise, i.e. has a "then" function,
 * otherwise returns false.
 */
export function isPromise(value: unknown): value is Promise<unknown> {
  return typeof value?.then === 'function';
}
