import type { ObjMap } from './ObjMap.ts';
import type { PromiseOrValue } from './PromiseOrValue.ts';

/**
 * This function transforms a JS object `ObjMap<Promise<T>>` into
 * a `Promise<ObjMap<T>>`
 *
 * This is akin to bluebird's `Promise.props`, but implemented only using
 * `Promise.all` so it will work with any implementation of ES6 promises.
 *
 * @internal
 */
export function promiseForObject<T>(
  object: Readonly<ObjMap<PromiseOrValue<T>>>,
  promiseAll: <TValue>(
    values: ReadonlyArray<PromiseOrValue<TValue>>,
  ) => Promise<Array<TValue>>,
): Promise<ObjMap<T>> {
  const keys = Object.keys(object);
  const values = Object.values(object);

  return promiseAll(values).then((resolvedValues) => {
    const resolvedObject = Object.create(null);
    for (let i = 0; i < keys.length; ++i) {
      resolvedObject[keys[i]] = resolvedValues[i];
    }
    return resolvedObject;
  });
}
