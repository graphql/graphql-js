import { isPromise } from "./isPromise.mjs";
export function promiseReduce(values, callbackFn, initialValue) {
    let accumulator = initialValue;
    for (const value of values) {
        accumulator = isPromise(accumulator)
            ? accumulator.then((resolved) => callbackFn(resolved, value))
            : callbackFn(accumulator, value);
    }
    return accumulator;
}
//# sourceMappingURL=promiseReduce.mjs.map