'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.groupBy = void 0;
const AccumulatorMap_js_1 = require('./AccumulatorMap.js');
/**
 * Groups array items into a Map, given a function to produce grouping key.
 */
function groupBy(list, keyFn) {
  const result = new AccumulatorMap_js_1.AccumulatorMap();
  for (const item of list) {
    result.add(keyFn(item), item);
  }
  return result;
}
exports.groupBy = groupBy;
