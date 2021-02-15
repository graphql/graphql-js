"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.objectEntries = void 0;

/* eslint-disable no-redeclare */
// $FlowFixMe[name-already-bound] workaround for: https://github.com/facebook/flow/issues/4441
const objectEntries = Object.entries || (obj => Object.keys(obj).map(key => [key, obj[key]]));

exports.objectEntries = objectEntries;
