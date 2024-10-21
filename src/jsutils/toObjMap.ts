import type { Maybe } from './Maybe.js';
import type {
  ReadOnlyObjMap,
  ReadOnlyObjMapLike,
  ReadOnlyObjMapSymbolLike,
  ReadOnlyObjMapWithSymbol,
} from './ObjMap.js';

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

export function toObjMapWithSymbols<T>(
  obj: Maybe<ReadOnlyObjMapSymbolLike<T>>,
): ReadOnlyObjMapWithSymbol<T> {
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

  for (const key of Object.getOwnPropertySymbols(obj)) {
    map[key] = obj[key];
  }

  return map;
}
