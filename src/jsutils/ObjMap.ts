export type ObjMap<T> = Record<string, T>;
export type ObjMapLike<T> = ObjMap<T> | Record<string, T>;

export type ReadOnlyObjMap<T> = Readonly<Record<string, T>>;
export type ReadOnlyObjMapLike<T> =
  | ReadOnlyObjMap<T>
  | Readonly<Record<string, T>>;
