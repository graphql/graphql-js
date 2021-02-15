"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.objectValues = void 0;

/* eslint-disable no-redeclare */
// $FlowFixMe[name-already-bound] workaround for: https://github.com/facebook/flow/issues/4441
const objectValues = Object.values || (obj => Object.keys(obj).map(key => obj[key]));

exports.objectValues = objectValues;
