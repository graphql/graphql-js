import { isSameSet } from './isSameSet.ts';
export function getBySet<T, U>(
  map: ReadonlyMap<ReadonlySet<T>, U>,
  setToMatch: ReadonlySet<T>,
): U | undefined {
  for (const set of map.keys()) {
    if (isSameSet(set, setToMatch)) {
      return map.get(set);
    }
  }
  return undefined;
}
