/**
 * Memoizes the provided three-argument function.
 */
export function memoize3<
  A1 extends object,
  A2 extends object,
  A3 extends object,
  R,
>(fn: (a1: A1, a2: A2, a3: A3) => R): (a1: A1, a2: A2, a3: A3) => R {
  let cache0: WeakMap<A1, WeakMap<A2, WeakMap<A3, R>>>;

  return function memoized(a1, a2, a3) {
    if (cache0 === undefined) {
      cache0 = new WeakMap();
    }

    let cache1 = cache0.get(a1);
    if (cache1 === undefined) {
      cache1 = new WeakMap();
      cache0.set(a1, cache1);
    }

    let cache2 = cache1.get(a2);
    if (cache2 === undefined) {
      cache2 = new WeakMap();
      cache1.set(a2, cache2);
    }

    let fnResult = cache2.get(a3);
    if (fnResult === undefined) {
      fnResult = fn(a1, a2, a3);
      cache2.set(a3, fnResult);
    }

    return fnResult;
  };
}
