/**
 * Quoted as "used by external libraries".
 * All of these could be replaced by Record\<string, T\> or Readonly\<Record\<string, T\>\>
 * Should we still expose these?
 */

export interface ObjMap<T> {
  [key: string]: T;
}

export type ObjMapLike<T> = ObjMap<T> | { [key: string]: T };

export interface ReadOnlyObjMap<T> {
  readonly [key: string]: T;
}

export type ReadOnlyObjMapLike<T> =
  | ReadOnlyObjMap<T>
  | { readonly [key: string]: T };
