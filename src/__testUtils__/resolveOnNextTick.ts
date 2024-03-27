export function resolveOnNextTick(): Promise<void>;
export function resolveOnNextTick<T>(value: T): Promise<T>;
export function resolveOnNextTick(
  value: unknown = undefined,
): Promise<unknown> {
  return Promise.resolve(value);
}
