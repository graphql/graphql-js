import { AccumulatorMap } from './AccumulatorMap.mjs';
/**
 * Groups array items into a Map, given a function to produce grouping key.
 */
export function groupBy(list, keyFn) {
  const result = new AccumulatorMap();
  for (const item of list) {
    result.add(keyFn(item), item);
  }
  return result;
}
