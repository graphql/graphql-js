import type { PromiseOrValue } from './PromiseOrValue';
/**
 * Similar to Array.prototype.reduce(), however the reducing callback may return
 * a Promise, in which case reduction will continue after each promise resolves.
 *
 * If the callback does not return a Promise, then this function will also not
 * return a Promise.
 */
export function promiseReduce<T, U>(
  values: ReadonlyArray<T>,
  callback: (U: any, T: any) => PromiseOrValue<U>,
  initialValue: PromiseOrValue<U>,
): PromiseOrValue<U>;
