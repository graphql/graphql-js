/**
 * Returns a boolean indicating if all elements of setA are in setB
 *
 * See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/isSubsetOf
 *
 */
export function setIsSubsetOf<T>(
  setA: ReadonlySet<T>,
  setB: ReadonlySet<T>,
): boolean {
  if (setA.size > setB.size) {
    return false;
  }
  for (const item of setA) {
    if (!setB.has(item)) {
      return false;
    }
  }
  return true;
}
