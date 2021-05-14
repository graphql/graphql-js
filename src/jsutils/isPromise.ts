/**
 * Returns true if the value acts like a Promise, i.e. has a "then" function,
 * otherwise returns false.
 */
export function isPromise(value: unknown): value is Promise<unknown> {
  // eslint-disable-next-line @typescript-eslint/dot-notation
  return typeof value?.['then'] === 'function';
}
