"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invariant = invariant;
function invariant(condition, message) {
    if (!condition) {
        throw new Error(message ?? 'Unexpected invariant triggered.');
    }
}
//# sourceMappingURL=invariant.js.map