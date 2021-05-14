/**
 * Returns true if the provided object implements the AsyncIterator protocol via
 * implementing a `Symbol.asyncIterator` method.
 */
declare function isAsyncIterable(
  value: mixed,
  // $FlowFixMe[invalid-in-rhs]
): boolean %checks(value instanceof AsyncIterable);

// eslint-disable-next-line no-redeclare
export function isAsyncIterable(maybeAsyncIterable) {
  return typeof maybeAsyncIterable?.[Symbol.asyncIterator] === 'function';
}
