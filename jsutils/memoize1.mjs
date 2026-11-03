export function memoize1(fn) {
    let cache0;
    return function memoized(a1) {
        cache0 ??= new WeakMap();
        let fnResult = cache0.get(a1);
        if (fnResult === undefined) {
            fnResult = fn(a1);
            cache0.set(a1, fnResult);
        }
        return fnResult;
    };
}
//# sourceMappingURL=memoize1.mjs.map