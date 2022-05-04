/**
 * Groups array items into a Map, given a function to produce grouping key.
 */
export function groupBy<K, T>(
  list: ReadonlyArray<T>,
  keyFn: (item: T) => K,
): Map<K, ReadonlyArray<T>> {
  const result = new Map<K, Array<T>>();
  for (const item of list) {
    const key = keyFn(item);
    const group = result.get(key);
    if (group === undefined) {
      result.set(key, [item]);
    } else {
      group.push(item);
    }
  }
  return result;
}
