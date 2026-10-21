import type { ObjMap } from "./ObjMap.js";
/**
 * Creates a keyed JS object from an array, given a function to produce the keys
 * for each value in the array.
 *
 * This provides a convenient lookup for the array items if the key function
 * produces unique results.
 * @internal
 * @example
 * ```ts
 * import { keyMap } from 'graphql/jsutils/keyMap';
 *
 * const phoneBook = [
 *   { name: 'Jon', num: '555-1234' },
 *   { name: 'Jenny', num: '867-5309' },
 * ];
 *
 * const entriesByName = keyMap(phoneBook, (entry) => entry.name);
 *
 * Object.keys(entriesByName); // => ['Jon', 'Jenny']
 * entriesByName['Jenny']; // => { name: 'Jenny', num: '867-5309' }
 * ```
 */
export declare function keyMap<T>(list: ReadonlyArray<T>, keyFn: (item: T) => string): ObjMap<T>;
