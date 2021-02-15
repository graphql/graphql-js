/**
 * Returns true if the value acts like a Promise, i.e. has a "then" function,
 * otherwise returns false.
 */
// eslint-disable-next-line no-redeclare
export function isPromise(value) {
  return typeof value?.then === 'function';
}
