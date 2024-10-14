"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invariant = void 0;
function invariant(condition, message) {
    if (!condition) {
        throw new Error(message ?? 'Unexpected invariant triggered.');
    }
}
exports.invariant = invariant;
//# sourceMappingURL=invariant.js.map