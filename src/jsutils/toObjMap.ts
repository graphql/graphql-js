import type { Maybe } from './Maybe';
import type { ReadOnlyObjMap, ReadOnlyObjMapLike } from './ObjMap';

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
  const entries = Object.entries(obj)
  for (let i = 0; i < entries.length; i++) {
    const { 0: key, 1: value } = entries[i]
    map[key] = value;
  }
  return map;
}
