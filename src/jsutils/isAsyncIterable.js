import { SYMBOL_ASYNC_ITERATOR } from '../polyfills/symbols';

/**
 * Returns true if the provided object implements the AsyncIterator protocol via
 * either implementing a `Symbol.asyncIterator` or `"@@asyncIterator"` method.
 */
declare function isAsyncIterable(value: mixed): boolean %checks(value instanceof
  AsyncIterable);

// eslint-disable-next-line no-redeclare
export default function isAsyncIterable(maybeAsyncIterable) {
  return typeof maybeAsyncIterable?.[SYMBOL_ASYNC_ITERATOR] === 'function';
}
