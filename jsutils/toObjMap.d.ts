import type { Maybe } from './Maybe.js';
import type { ReadOnlyObjMap, ReadOnlyObjMapLike } from './ObjMap.js';
export declare function toObjMap<T>(
  obj: Maybe<ReadOnlyObjMapLike<T>>,
): ReadOnlyObjMap<T>;
