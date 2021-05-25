import type {
  ObjMap,
  ObjMapLike,
  ReadOnlyObjMap,
  ReadOnlyObjMapLike,
} from './ObjMap';
export declare function toObjMap<T>(obj: ObjMapLike<T>): ObjMap<T>;
export declare function toObjMap<T>(
  obj: ReadOnlyObjMapLike<T>,
): ReadOnlyObjMap<T>;
