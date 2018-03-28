'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.subscribe = exports.createSourceEventStream = undefined;

var _subscribe = require('./subscribe');

Object.defineProperty(exports, 'subscribe', {
  enumerable: true,
  get: function get() {
    return _subscribe.subscribe;
  }
});
Object.defineProperty(exports, 'createSourceEventStream', {
  enumerable: true,
  get: function get() {
    return _subscribe.createSourceEventStream;
  }
});
