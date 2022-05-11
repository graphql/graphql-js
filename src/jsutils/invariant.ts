export function invariant(
  condition: boolean,
  message?: string,
): asserts condition {
  if (!condition) {
    throw new Error(
      message != null ? message : 'Unexpected invariant triggered.',
    );
  }
}
