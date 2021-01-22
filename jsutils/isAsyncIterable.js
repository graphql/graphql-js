"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = isAsyncIterable;

var _symbols = require("../polyfills/symbols.js");

// eslint-disable-next-line no-redeclare
function isAsyncIterable(maybeAsyncIterable) {
  return typeof (maybeAsyncIterable === null || maybeAsyncIterable === void 0 ? void 0 : maybeAsyncIterable[_symbols.SYMBOL_ASYNC_ITERATOR]) === 'function';
}
