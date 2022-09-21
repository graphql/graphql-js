'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.isAsyncIterable = void 0;
/**
 * Returns true if the provided object implements the AsyncIterator protocol via
 * implementing a `Symbol.asyncIterator` method.
 */
function isAsyncIterable(maybeAsyncIterable) {
  return typeof maybeAsyncIterable?.[Symbol.asyncIterator] === 'function';
}
exports.isAsyncIterable = isAsyncIterable;
