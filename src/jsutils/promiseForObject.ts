import type { ObjMap } from './ObjMap.js';

/**
 * This function transforms a JS object `ObjMap<Promise<T>>` into
 * a `Promise<ObjMap<T>>`
 *
 * This is akin to bluebird's `Promise.props`, but implemented only using
 * `Promise.all` so it will work with any implementation of ES6 promises.
 */
export async function promiseForObject<T, U>(
  object: ObjMap<Promise<T>>,
  callback: (object: ObjMap<T>) => U,
): Promise<U> {
  const keys = Object.keys(object);
  const values = Object.values(object);

  const resolvedValues = await Promise.all(values);
  const resolvedObject = Object.create(null);
  for (let i = 0; i < keys.length; ++i) {
    resolvedObject[keys[i]] = resolvedValues[i];
  }
  return callback(resolvedObject);
}
