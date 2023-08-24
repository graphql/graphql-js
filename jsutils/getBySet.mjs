import { isSameSet } from './isSameSet.mjs';
export function getBySet(map, setToMatch) {
  for (const set of map.keys()) {
    if (isSameSet(set, setToMatch)) {
      return map.get(set);
    }
  }
  return undefined;
}
