'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.andList = exports.orList = void 0;
const invariant_js_1 = require('./invariant.js');
/**
 * Given [ A, B, C ] return 'A, B, or C'.
 */
function orList(items) {
  return formatList('or', items);
}
exports.orList = orList;
/**
 * Given [ A, B, C ] return 'A, B, and C'.
 */
function andList(items) {
  return formatList('and', items);
}
exports.andList = andList;
function formatList(conjunction, items) {
  items.length !== 0 || (0, invariant_js_1.invariant)(false);
  switch (items.length) {
    case 1:
      return items[0];
    case 2:
      return items[0] + ' ' + conjunction + ' ' + items[1];
  }
  const allButLast = items.slice(0, -1);
  const lastItem = items.at(-1);
  return allButLast.join(', ') + ', ' + conjunction + ' ' + lastItem;
}
