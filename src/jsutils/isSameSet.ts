export function isSameSet<T>(
  setA: ReadonlySet<T>,
  setB: ReadonlySet<T>,
): boolean {
  if (setA.size !== setB.size) {
    return false;
  }
  for (const item of setA) {
    if (!setB.has(item)) {
      return false;
    }
  }
  return true;
}
