export interface ObjMap<T> {
  [key: string]: T;
  __proto__: never;
}

export type ObjMapLike<T> = ObjMap<T> | { [key: string]: T };

export interface ReadOnlyObjMap<T> {
  readonly [key: string]: T;
  __proto__: never;
}

export type ReadOnlyObjMapLike<T> =
  | ReadOnlyObjMap<T>
  | { readonly [key: string]: T };
