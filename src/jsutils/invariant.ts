export function invariant(
  condition: boolean,
  message?: string,
): asserts condition {
  if (!condition) {
    throw new Error(message ?? 'Unexpected invariant triggered.');
  }
}
