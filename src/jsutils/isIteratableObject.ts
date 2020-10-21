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
declare function isIteratableObject(
  value: unknown,
  // $FlowFixMe[invalid-in-rhs]
): value is Iterable<unknown>;

// eslint-disable-next-line no-redeclare
export function isIteratableObject(maybeIteratable: unknown): boolean {
  return (
    typeof maybeIteratable === 'object' &&
    typeof maybeIteratable?.[Symbol.iterator] === 'function'
  );
}
