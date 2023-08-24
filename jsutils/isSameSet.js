'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.isSameSet = void 0;
function isSameSet(setA, setB) {
  if (setA.size !== setB.size) {
    return false;
  }
  for (const item of setA) {
    if (!setB.has(item)) {
      return false;
    }
  }
  return true;
}
exports.isSameSet = isSameSet;
