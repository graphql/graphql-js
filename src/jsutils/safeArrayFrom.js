import { SYMBOL_ITERATOR } from '../polyfills/symbols';

/**
 * Safer version of `Array.from` that return `null` if value isn't convertible to array.
 * Also protects against Array-like objects without items.
 *
 * @example
 *
 * safeArrayFrom([ 1, 2, 3 ]) // [1, 2, 3]
 * safeArrayFrom('ABC') // null
 * safeArrayFrom({ length: 1 }) // null
 * safeArrayFrom({ length: 1, 0: 'Alpha' }) // ['Alpha']
 * safeArrayFrom({ key: 'value' }) // null
 * safeArrayFrom(new Map()) // []
 *
 */
export default function safeArrayFrom<T>(
  collection: mixed,
  mapFn: (elem: mixed, index: number) => T = (item) => ((item: any): T),
): Array<T> | null {
  if (collection == null || typeof collection !== 'object') {
    return null;
  }

  if (Array.isArray(collection)) {
    return collection.map(mapFn);
  }

  // Is Iterable?
  const iteratorMethod = collection[SYMBOL_ITERATOR];
  if (typeof iteratorMethod === 'function') {
    // $FlowFixMe[incompatible-use]
    const iterator = iteratorMethod.call(collection);
    const result = [];
    let step;

    for (let i = 0; !(step = iterator.next()).done; ++i) {
      result.push(mapFn(step.value, i));
    }
    return result;
  }

  // Is Array like?
  const length = collection.length;
  if (typeof length === 'number' && length >= 0 && length % 1 === 0) {
    const result = [];
    for (let i = 0; i < length; ++i) {
      if (!Object.prototype.hasOwnProperty.call(collection, i)) {
        return null;
      }
      result.push(mapFn(collection[String(i)], i));
    }

    return result;
  }

  return null;
}
