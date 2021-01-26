/**
 * Returns true if the provided object implements the AsyncIterator protocol via
 * either implementing a `Symbol.asyncIterator` or `"@@asyncIterator"` method.
 */
export function isAsyncIterable(
  maybeAsyncIterable: any,
): maybeAsyncIterable is AsyncIterable<unknown> {
  return typeof maybeAsyncIterable?.[Symbol.asyncIterator] === 'function';
}
