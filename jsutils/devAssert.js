"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = devAssert;

/* istanbul ignore file */
function devAssert(condition, message) {
  var booleanCondition = Boolean(condition);
  /* istanbul ignore else */

  if (!booleanCondition) {
    throw new Error(message);
  }
}
