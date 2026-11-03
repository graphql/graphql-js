export function memoize2(fn) {
    let cache0;
    return function memoized(a1, a2) {
        cache0 ??= new WeakMap();
        let cache1 = cache0.get(a1);
        if (cache1 === undefined) {
            cache1 = new WeakMap();
            cache0.set(a1, cache1);
        }
        let fnResult = cache1.get(a2);
        if (fnResult === undefined) {
            fnResult = fn(a1, a2);
            cache1.set(a2, fnResult);
        }
        return fnResult;
    };
}
//# sourceMappingURL=memoize2.mjs.map