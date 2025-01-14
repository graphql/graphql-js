"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.devAssert = devAssert;
function devAssert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
//# sourceMappingURL=devAssert.js.map