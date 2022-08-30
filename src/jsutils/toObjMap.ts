import type { Maybe } from './Maybe.js';
import type { ReadOnlyObjMap, ReadOnlyObjMapLike } from './ObjMap.js';

export function toObjMap<T>(
  obj: Maybe<ReadOnlyObjMapLike<T>>,
): ReadOnlyObjMap<T> {
  if (obj == null) {
    return Object.create(null);
  }

  if (Object.getPrototypeOf(obj) === null) {
    return obj;
  }

  const map = Object.create(null);
  for (const [key, value] of Object.entries(obj)) {
    map[key] = value;
  }
  return map;
}
