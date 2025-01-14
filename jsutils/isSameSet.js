"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSameSet = isSameSet;
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
//# sourceMappingURL=isSameSet.js.map