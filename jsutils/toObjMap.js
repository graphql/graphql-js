'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.toObjMap = toObjMap;

/* eslint-disable no-redeclare */
function toObjMap(obj) {
  /* eslint-enable no-redeclare */
  if (Object.getPrototypeOf(obj) === null) {
    return obj;
  }

  const map = Object.create(null);

  for (const [key, value] of Object.entries(obj)) {
    map[key] = value;
  }

  return map;
}
