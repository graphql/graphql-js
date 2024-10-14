import type { Maybe } from './Maybe.js';
import type { ReadOnlyObjMap, ReadOnlyObjMapLike, ReadOnlyObjMapSymbolLike, ReadOnlyObjMapWithSymbol } from './ObjMap.js';
export declare function toObjMap<T>(obj: Maybe<ReadOnlyObjMapLike<T>>): ReadOnlyObjMap<T>;
export declare function toObjMapWithSymbols<T>(obj: Maybe<ReadOnlyObjMapSymbolLike<T>>): ReadOnlyObjMapWithSymbol<T>;
