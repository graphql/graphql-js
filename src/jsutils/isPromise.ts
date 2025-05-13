/**
 * Returns true if the value acts like a Promise, i.e. has a "then" function,
 * otherwise returns false.
 */
export function isPromise(value: any): value is PromiseLike<unknown> {
  return typeof value?.then === 'function';
}
