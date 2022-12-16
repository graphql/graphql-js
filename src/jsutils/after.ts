import { isPromise } from './isPromise.js';
import type { PromiseOrValue } from './PromiseOrValue.js';

export async function after<T, R>(
  promise: Promise<T>,
  onFulfilled: (value: T) => PromiseOrValue<R>,
): Promise<R> {
  const result = onFulfilled(await promise);
  if (isPromise(result)) {
    return await result;
  }
  return result;
}
