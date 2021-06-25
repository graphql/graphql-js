import { MaybePromise } from './maybePromise';
import type { ObjMap } from './ObjMap';

/**
 * This function transforms a JS object `ObjMap<MaybePromise<T>>` into
 * a `MaybePromise<ObjMap<T>>`
 *
 * This is akin to bluebird's `Promise.props`.
 */
export function maybePromiseForObject<T>(
  object: ObjMap<MaybePromise<T>>,
): MaybePromise<ObjMap<T>> {
  return MaybePromise.all(Object.values(object)).then((resolvedValues) => {
    const resolvedObject = Object.create(null);
    for (const [i, key] of Object.keys(object).entries()) {
      resolvedObject[key] = resolvedValues[i];
    }
    return resolvedObject;
  });
}
