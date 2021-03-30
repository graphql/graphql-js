/**
 * Returns true if the provided object is an Object (i.e. not a string literal)
 * and implements the Iterator protocol.
 *
 * This may be used in place of [Array.isArray()][isArray] to determine if
 * an object should be iterated-over e.g. Array, Map, Set, Int8Array,
 * TypedArray, etc. but excludes string literals.
 *
 * @example
 *
 * isIteratableObject([ 1, 2, 3 ]) // true
 * isIteratableObject(new Map()) // true
 * isIteratableObject('ABC') // false
 * isIteratableObject({ key: 'value' }) // false
 * isIteratableObject({ length: 1, 0: 'Alpha' }) // false
 */
export function isIteratableObject(
  maybeIteratable: unknown,
): maybeIteratable is Iterable<unknown>;
