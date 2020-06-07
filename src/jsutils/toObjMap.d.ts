import {
  ObjMap,
  ObjMapLike,
  ReadOnlyObjMap,
  ReadOnlyObjMapLike,
} from './ObjMap';

declare function toObjMap<T>(obj: ObjMapLike<T>): ObjMap<T>;
declare function toObjMap<T>(obj: ReadOnlyObjMapLike<T>): ReadOnlyObjMap<T>;

export default toObjMap;
