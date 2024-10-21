export interface ObjMap<T> {
  [key: string]: T;
}

export type ObjMapLike<T> = ObjMap<T> | { [key: string]: T };

export interface ReadOnlyObjMap<T> {
  readonly [key: string]: T;
}

export interface ReadOnlyObjMapWithSymbol<T> {
  readonly [key: string | symbol]: T;
}

export type ReadOnlyObjMapLike<T> =
  | ReadOnlyObjMap<T>
  | { readonly [key: string]: T };

export type ReadOnlyObjMapSymbolLike<T> =
  | ReadOnlyObjMapWithSymbol<T>
  | { readonly [key: string | symbol]: T };
