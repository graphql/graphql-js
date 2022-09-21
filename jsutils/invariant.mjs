export function invariant(condition, message) {
  if (!condition) {
    throw new Error(
      message != null ? message : 'Unexpected invariant triggered.',
    );
  }
}
