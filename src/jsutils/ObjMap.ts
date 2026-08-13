/** @internal */
export interface ObjMap<T> {
  [key: string]: T;
}

/** @internal */
export type ObjMapLike<T> = ObjMap<T> | { [key: string]: T };

/** @internal */
export interface ReadOnlyObjMap<T> {
  readonly [key: string]: T;
}

/** @internal */
export type ReadOnlyObjMapLike<T> =
  | ReadOnlyObjMap<T>
  | { readonly [key: string]: T };
