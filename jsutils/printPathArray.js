"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printPathArray = void 0;
/**
 * Build a string describing the path.
 */
function printPathArray(path) {
    if (path.length === 0) {
        return '';
    }
    return ` at ${path
        .map((key) => (typeof key === 'number' ? `[${key}]` : `.${key}`))
        .join('')}`;
}
exports.printPathArray = printPathArray;
//# sourceMappingURL=printPathArray.js.map