"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = isAsyncIterable;

var _symbols = require("../polyfills/symbols.js");

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

// eslint-disable-next-line no-redeclare
function isAsyncIterable(maybeAsyncIterable) {
  if (maybeAsyncIterable == null || _typeof(maybeAsyncIterable) !== 'object') {
    return false;
  }

  return typeof maybeAsyncIterable[_symbols.SYMBOL_ASYNC_ITERATOR] === 'function';
}
