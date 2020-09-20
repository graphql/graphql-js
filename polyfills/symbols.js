"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SYMBOL_TO_STRING_TAG = exports.SYMBOL_ASYNC_ITERATOR = exports.SYMBOL_ITERATOR = void 0;
// In ES2015 (or a polyfilled) environment, this will be Symbol.iterator
// istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2317')
var SYMBOL_ITERATOR = typeof Symbol === 'function' && Symbol.iterator != null ? Symbol.iterator : '@@iterator'; // In ES2017 (or a polyfilled) environment, this will be Symbol.asyncIterator
// istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2317')

exports.SYMBOL_ITERATOR = SYMBOL_ITERATOR;
var SYMBOL_ASYNC_ITERATOR = typeof Symbol === 'function' && Symbol.asyncIterator != null ? Symbol.asyncIterator : '@@asyncIterator'; // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2317')

exports.SYMBOL_ASYNC_ITERATOR = SYMBOL_ASYNC_ITERATOR;
var SYMBOL_TO_STRING_TAG = typeof Symbol === 'function' && Symbol.toStringTag != null ? Symbol.toStringTag : '@@toStringTag';
exports.SYMBOL_TO_STRING_TAG = SYMBOL_TO_STRING_TAG;
