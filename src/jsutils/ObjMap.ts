export interface ObjMap<T> {
  [key: string | symbol]: T;
}

export type ObjMapLike<T> = ObjMap<T> | { [key: string | symbol]: T };

export interface ReadOnlyObjMap<T> {
  readonly [key: string | symbol]: T;
}

export type ReadOnlyObjMapLike<T> =
  | ReadOnlyObjMap<T>
  | { readonly [key: string | symbol]: T };
