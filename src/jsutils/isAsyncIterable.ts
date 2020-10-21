/**
 * Returns true if the provided object implements the AsyncIterator protocol via
 * implementing a `Symbol.asyncIterator` method.
 */
declare function isAsyncIterable(
  value: unknown,
  // $FlowFixMe[invalid-in-rhs]
): value is AsyncIterable<unknown>;

// eslint-disable-next-line no-redeclare
export function isAsyncIterable(maybeAsyncIterable) {
  return typeof maybeAsyncIterable?.[Symbol.asyncIterator] === 'function';
}
