"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPromise = isPromise;
exports.isPromiseLike = isPromiseLike;
function isPromise(value) {
    return value instanceof Promise;
}
function isPromiseLike(value) {
    return (value !== null &&
        (typeof value === 'object' || typeof value === 'function') &&
        typeof value.then === 'function');
}
//# sourceMappingURL=isPromise.js.map