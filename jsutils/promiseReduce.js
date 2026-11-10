"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.promiseReduce = promiseReduce;
const isPromise_ts_1 = require("./isPromise.js");
function promiseReduce(values, callbackFn, initialValue) {
    let accumulator = initialValue;
    for (const value of values) {
        accumulator = (0, isPromise_ts_1.isPromiseLike)(accumulator)
            ? accumulator.then((resolved) => callbackFn(resolved, value))
            : callbackFn(accumulator, value);
    }
    return accumulator;
}
//# sourceMappingURL=promiseReduce.js.map