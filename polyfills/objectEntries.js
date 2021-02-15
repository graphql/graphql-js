"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.objectEntries = void 0;

/* eslint-disable no-redeclare */
// $FlowFixMe[name-already-bound] workaround for: https://github.com/facebook/flow/issues/4441
var objectEntries = Object.entries || function (obj) {
  return Object.keys(obj).map(function (key) {
    return [key, obj[key]];
  });
};

exports.objectEntries = objectEntries;
