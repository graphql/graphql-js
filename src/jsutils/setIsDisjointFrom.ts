/**
 * Returns a boolean indicating if setA has no elements in common with setB.
 *
 * See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/isDisjointFrom
 *
 */

export function setIsDisjointFrom<T>(
  setA: ReadonlySet<T>,
  setB: ReadonlySet<T>,
): boolean {
  if (setA.size <= setB.size) {
    for (const item of setA) {
      if (setB.has(item)) {
        return false;
      }
    }
  } else {
    for (const item of setB) {
      if (!setA.has(item)) {
        return false;
      }
    }
  }
  return true;
}
