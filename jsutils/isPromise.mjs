/**
 * Returns true if the value acts like a Promise, i.e. has a "then" function,
 * otherwise returns false.
 */
export function isPromise(value) {
  return typeof value?.then === 'function';
}
