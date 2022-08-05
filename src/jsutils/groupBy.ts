import { AccumulatorMap } from './AccumulatorMap';

/**
 * Groups array items into a Map, given a function to produce grouping key.
 */
export function groupBy<K, T>(
  list: ReadonlyArray<T>,
  keyFn: (item: T) => K,
): Map<K, ReadonlyArray<T>> {
  const result = new AccumulatorMap<K, T>();
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    result.add(keyFn(item), item);
  }
  return result;
}
