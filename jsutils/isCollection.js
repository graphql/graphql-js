"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = isCollection;

var _symbols = require("../polyfills/symbols.js");

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

// eslint-disable-next-line no-redeclare
function isCollection(obj) {
  if (obj == null || _typeof(obj) !== 'object') {
    return false;
  } // Is Array like?


  var length = obj.length;

  if (typeof length === 'number' && length >= 0 && length % 1 === 0) {
    return true;
  } // Is Iterable?


  return typeof obj[_symbols.SYMBOL_ITERATOR] === 'function';
}
