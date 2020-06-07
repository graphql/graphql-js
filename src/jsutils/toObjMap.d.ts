import {
  ObjMap,
  ObjMapLike,
  ReadOnlyObjMap,
  ReadOnlyObjMapLike,
} from './ObjMap';

// eslint-disable-next-line import/export
export default function toObjMap<T>(obj: ObjMapLike<T>): ObjMap<T>;
// eslint-disable-next-line import/export
export default function toObjMap<T>(
  obj: ReadOnlyObjMapLike<T>,
): ReadOnlyObjMap<T>;
