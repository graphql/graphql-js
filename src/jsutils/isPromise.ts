/**
 * Returns true if the value acts like a Promise, i.e. has a "then" function,
 * otherwise returns false.
 */
export function isPromise<T = unknown>(
  value: unknown | Promise<T>,
): value is Promise<T> {
  return typeof (value as any)?.then === 'function';
}
