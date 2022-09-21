'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.promiseForObject = void 0;
/**
 * This function transforms a JS object `ObjMap<Promise<T>>` into
 * a `Promise<ObjMap<T>>`
 *
 * This is akin to bluebird's `Promise.props`, but implemented only using
 * `Promise.all` so it will work with any implementation of ES6 promises.
 */
async function promiseForObject(object) {
  const keys = Object.keys(object);
  const values = Object.values(object);
  const resolvedValues = await Promise.all(values);
  const resolvedObject = Object.create(null);
  for (let i = 0; i < keys.length; ++i) {
    resolvedObject[keys[i]] = resolvedValues[i];
  }
  return resolvedObject;
}
exports.promiseForObject = promiseForObject;
