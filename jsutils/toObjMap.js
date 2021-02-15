"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.toObjMap = toObjMap;

var _objectEntries = require("../polyfills/objectEntries.js");

function toObjMap(obj) {
  /* eslint-enable no-redeclare */
  if (Object.getPrototypeOf(obj) === null) {
    return obj;
  }

  const map = Object.create(null);

  for (const [key, value] of (0, _objectEntries.objectEntries)(obj)) {
    map[key] = value;
  }

  return map;
}
