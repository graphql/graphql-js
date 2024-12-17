/**
 * Memoizes the provided two-argument function.
 */
export function memoize2<A1 extends object, A2 extends object, R>(
  fn: (a1: A1, a2: A2) => R,
): (a1: A1, a2: A2) => R {
  let cache0: WeakMap<A1, WeakMap<A2, R>>;

  return function memoized(a1, a2) {
    if (cache0 === undefined) {
      cache0 = new WeakMap();
    }

    let cache1 = cache0.get(a1);
    if (cache1 === undefined) {
      cache1 = new WeakMap();
      cache0.set(a1, cache1);
    }

    let fnResult = cache1.get(a2);
    if (fnResult === undefined) {
      fnResult = fn(a1, a2);
      cache1.set(a2, fnResult);
    }

    return fnResult;
  };
}
