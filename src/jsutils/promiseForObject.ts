import type { ObjMap } from './ObjMap';

/**
 * This function transforms a JS object `ObjMap<Promise<T>>` into
 * a `Promise<ObjMap<T>>`
 *
 * This is akin to bluebird's `Promise.props`, but implemented only using
 * `Promise.all` so it will work with any implementation of ES6 promises.
 */
export function promiseForObject<T>(
  object: ObjMap<Promise<T>>,
): Promise<ObjMap<T>> {
  return Promise.all(Object.values(object)).then((resolvedValues) => {
    const resolvedObject = Object.create(null);
    const entries = Array.from(Object.keys(object).entries());
    for (const [i, key] of entries) {
      resolvedObject[key] = resolvedValues[i];
    }
    return resolvedObject;
  });
}
