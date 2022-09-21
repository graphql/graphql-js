'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.devAssert = void 0;
function devAssert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
exports.devAssert = devAssert;
