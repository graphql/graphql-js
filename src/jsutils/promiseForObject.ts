import type { ObjMap } from './ObjMap.js';
import type { PromiseOrValue } from './PromiseOrValue.js';

/**
 * This function transforms a JS object `ObjMap<Promise<T>>` into
 * a `Promise<ObjMap<T>>`
 *
 * This is akin to bluebird's `Promise.props`, but implemented only using
 * `Promise.all` so it will work with any implementation of ES6 promises.
 */
export async function promiseForObject<T>(
  object: ObjMap<PromiseOrValue<T>>,
): Promise<ObjMap<T>> {
  const values = Object.values(object);
  const resolvedValues = await Promise.all(values);

  const keys = Object.keys(object);
  for (let i = 0; i < keys.length; ++i) {
    object[keys[i]] = resolvedValues[i];
  }

  return object as unknown as Promise<ObjMap<T>>;
}
