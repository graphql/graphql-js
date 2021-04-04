'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.invariant = invariant;

function invariant(condition, message) {
  const booleanCondition = Boolean(condition); // istanbul ignore else (See transformation done in './resources/inlineInvariant.js')

  if (!booleanCondition) {
    throw new Error(
      message != null ? message : 'Unexpected invariant triggered.',
    );
  }
}
