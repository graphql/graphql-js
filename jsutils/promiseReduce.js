"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.promiseReduce = promiseReduce;

var _isPromise = require("./isPromise.js");

/**
 * Similar to Array.prototype.reduce(), however the reducing callback may return
 * a Promise, in which case reduction will continue after each promise resolves.
 *
 * If the callback does not return a Promise, then this function will also not
 * return a Promise.
 */
function promiseReduce(values, callback, initialValue) {
  return values.reduce(function (previous, value) {
    return (0, _isPromise.isPromise)(previous) ? previous.then(function (resolved) {
      return callback(resolved, value);
    }) : callback(previous, value);
  }, initialValue);
}
