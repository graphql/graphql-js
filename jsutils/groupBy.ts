import { AccumulatorMap } from './AccumulatorMap.ts';
/**
 * Groups array items into a Map, given a function to produce grouping key.
 */
export function groupBy<K, T>(
  list: ReadonlyArray<T>,
  keyFn: (item: T) => K,
): Map<K, ReadonlyArray<T>> {
  const result = new AccumulatorMap<K, T>();
  for (const item of list) {
    result.add(keyFn(item), item);
  }
  return result;
}
