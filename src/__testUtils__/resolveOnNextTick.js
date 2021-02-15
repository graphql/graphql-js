export function resolveOnNextTick(): Promise<void> {
  return Promise.resolve(undefined);
}
