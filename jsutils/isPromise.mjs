export function isPromise(value) {
    return value instanceof Promise;
}
export function isPromiseLike(value) {
    return typeof value?.then === 'function';
}
//# sourceMappingURL=isPromise.mjs.map