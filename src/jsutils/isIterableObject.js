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
 * isIterableObject([ 1, 2, 3 ]) // true
 * isIterableObject(new Map()) // true
 * isIterableObject('ABC') // false
 * isIterableObject({ key: 'value' }) // false
 * isIterableObject({ length: 1, 0: 'Alpha' }) // false
 */
declare function isIterableObject(
  value: mixed,
  // $FlowFixMe[invalid-in-rhs]
): boolean %checks(value instanceof Iterable);

// eslint-disable-next-line no-redeclare
export function isIterableObject(maybeIterable: mixed): boolean {
  return (
    typeof maybeIterable === 'object' &&
    typeof maybeIterable?.[Symbol.iterator] === 'function'
  );
}
