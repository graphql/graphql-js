/**
 * Quoted as "used by external libraries".
 * Should we still expose these?
 */
export type PromiseOrValue<T> = Promise<T> | T;
