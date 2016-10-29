/* @flow */

const ITERATOR_METHOD =
  typeof Symbol === 'function' ? Symbol.iterator : '@@iterator';

/**
 * Returns true when all of the items in the iterable are distinct from one
 * another. In other words checks for array uniqueness.
 */
export default function isDistinct <T>(iterable: Iterable<T>): boolean {
  const set = new Set();
  const iterator = (iterable: any)[ITERATOR_METHOD]();
  let current = iterator.next();
  while (!current.done) {
    if (set.has(current.value)) {
      return false;
    }
    set.add(current.value);
    current = iterator.next();
  }
  return true;
}
