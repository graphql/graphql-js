export function invariant(
  condition: unknown,
  message?: string,
): asserts condition {
  const booleanCondition = Boolean(condition);
  if (!booleanCondition) {
    throw new Error(
      message != null ? message : 'Unexpected invariant triggered.',
    );
  }
}
