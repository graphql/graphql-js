export default function resolveOnNextTick(): Promise<void> {
  return Promise.resolve(undefined);
}
