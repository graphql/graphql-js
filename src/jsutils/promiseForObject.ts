import { isPromise } from './isPromise.ts';
import type { ObjMap } from './ObjMap.ts';
import type { PromiseOrValue } from './PromiseOrValue.ts';

/**
 * This function transforms a JS object `ObjMap<Promise<T>>` into
 * a `Promise<ObjMap<T>>`
 *
 * This is akin to bluebird's `Promise.props`, but implemented only using
 * `Promise.all` so it will work with any implementation of ES6 promises.
 *
 * Only promise values are passed to `promiseAll`; synchronous values are
 * copied into the result as-is.
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
  const promiseIndices: Array<number> = [];
  const promises: Array<Promise<T>> = [];
  for (let i = 0; i < values.length; ++i) {
    const value = values[i];
    if (isPromise(value)) {
      promiseIndices.push(i);
      promises.push(value);
    }
  }

  return promiseAll(promises).then((resolvedValues) => {
    const resolvedObject = Object.create(null);
    let promiseIndex = 0;
    for (let i = 0; i < keys.length; ++i) {
      resolvedObject[keys[i]] =
        promiseIndices[promiseIndex] === i
          ? resolvedValues[promiseIndex++]
          : values[i];
    }
    return resolvedObject;
  });
}
