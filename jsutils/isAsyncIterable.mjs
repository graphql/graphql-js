function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

import { SYMBOL_ASYNC_ITERATOR } from "../polyfills/symbols.mjs";
/**
 * Returns true if the provided object implements the AsyncIterator protocol via
 * either implementing a `Symbol.asyncIterator` or `"@@asyncIterator"` method.
 */

// eslint-disable-next-line no-redeclare
export default function isAsyncIterable(maybeAsyncIterable) {
  if (maybeAsyncIterable == null || _typeof(maybeAsyncIterable) !== 'object') {
    return false;
  }

  return typeof maybeAsyncIterable[SYMBOL_ASYNC_ITERATOR] === 'function';
}
