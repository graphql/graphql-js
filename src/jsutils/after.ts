import type { PromiseOrValue } from './PromiseOrValue';

export async function after<T, U, R = T>(
  promise: Promise<T>,
  onFulfilled: (value: T) => PromiseOrValue<R>,
): Promise<R | U> {
  return onFulfilled(await promise);
}
