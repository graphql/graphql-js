import { SYMBOL_ASYNC_ITERATOR } from "../polyfills/symbols.js";
/**
 * Returns true if the provided object implements the AsyncIterator protocol via
 * either implementing a `Symbol.asyncIterator` or `"@@asyncIterator"` method.
 */

// eslint-disable-next-line no-redeclare
export default function isAsyncIterable(maybeAsyncIterable) {
  return typeof maybeAsyncIterable?.[SYMBOL_ASYNC_ITERATOR] === 'function';
}
