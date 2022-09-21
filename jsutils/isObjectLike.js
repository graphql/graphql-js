'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.isObjectLike = void 0;
/**
 * Return true if `value` is object-like. A value is object-like if it's not
 * `null` and has a `typeof` result of "object".
 */
function isObjectLike(value) {
  return typeof value == 'object' && value !== null;
}
exports.isObjectLike = isObjectLike;
