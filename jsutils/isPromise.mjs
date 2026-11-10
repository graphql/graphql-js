export function isPromise(value) {
    return value instanceof Promise;
}
export function isPromiseLike(value) {
    return (value !== null &&
        (typeof value === 'object' || typeof value === 'function') &&
        typeof value.then === 'function');
}
//# sourceMappingURL=isPromise.mjs.map