/** @internal */
export function isPromise(value: unknown): value is Promise<unknown> {
  return value instanceof Promise;
}

/**
 * Returns true if the value acts like a Promise, i.e. has a "then" function,
 * otherwise returns false.
 *
 * @internal
 */
export function isPromiseLike(value: any): value is PromiseLike<unknown> {
  return typeof value?.then === 'function';
}
