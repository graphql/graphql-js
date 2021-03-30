import type {
  ObjMap,
  ObjMapLike,
  ReadOnlyObjMap,
  ReadOnlyObjMapLike,
} from './ObjMap';

export function toObjMap<T>(obj: ObjMapLike<T>): ObjMap<T>;
export function toObjMap<T>(obj: ReadOnlyObjMapLike<T>): ReadOnlyObjMap<T>;
