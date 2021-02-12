"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = isAsyncIterable;

/**
 * Returns true if the provided object implements the AsyncIterator protocol via
 * either implementing a `Symbol.asyncIterator` or `"@@asyncIterator"` method.
 */
// eslint-disable-next-line no-redeclare
function isAsyncIterable(maybeAsyncIterable) {
  return typeof (maybeAsyncIterable === null || maybeAsyncIterable === void 0 ? void 0 : maybeAsyncIterable[Symbol.asyncIterator]) === 'function';
}
