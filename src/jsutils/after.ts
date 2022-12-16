import type { PromiseOrValue } from './PromiseOrValue';

export async function after<T, R>(
  promise: Promise<T>,
  onFulfilled: (value: T) => PromiseOrValue<R>,
): Promise<R> {
  return onFulfilled(await promise);
}
