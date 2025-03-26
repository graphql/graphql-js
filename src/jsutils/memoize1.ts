/**
 * Memoizes the provided single-argument function.
 */
export function memoize1<A1 extends object, R>(
  fn: (a1: A1) => R,
): (a1: A1) => R {
  let cache0: WeakMap<A1, R>;

  return function memoized(a1) {
    if (cache0 === undefined) {
      cache0 = new WeakMap();
    }

    let fnResult = cache0.get(a1);
    if (fnResult === undefined) {
      fnResult = fn(a1);
      cache0.set(a1, fnResult);
    }

    return fnResult;
  };
}
