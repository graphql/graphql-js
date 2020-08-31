/**
 * Returns true if the provided object implements the AsyncIterator protocol via
 * either implementing a `Symbol.asyncIterator` or `"@@asyncIterator"` method.
 */
declare function isAsyncIterable(value: mixed): boolean %checks(value instanceof
  AsyncIterable);

// eslint-disable-next-line no-redeclare
export default function isAsyncIterable(maybeAsyncIterable) {
  if (maybeAsyncIterable == null || typeof maybeAsyncIterable !== 'object') {
    return false;
  }

  return typeof maybeAsyncIterable[Symbol.asyncIterator] === 'function';
}
