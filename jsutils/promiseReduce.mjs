import { isPromiseLike } from "./isPromise.mjs";
export function promiseReduce(values, callbackFn, initialValue) {
    let accumulator = initialValue;
    for (const value of values) {
        accumulator = isPromiseLike(accumulator)
            ? accumulator.then((resolved) => callbackFn(resolved, value))
            : callbackFn(accumulator, value);
    }
    return accumulator;
}
//# sourceMappingURL=promiseReduce.mjs.map