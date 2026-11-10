"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapAsyncIterable = mapAsyncIterable;
const isPromise_ts_1 = require("../jsutils/isPromise.js");
const withConcurrentAbruptClose_ts_1 = require("./withConcurrentAbruptClose.js");
function mapAsyncIterable(iterable, callback) {
    const iterator = iterable[Symbol.asyncIterator]();
    const returnFn = iterator.return?.bind(iterator);
    const throwFn = iterator.throw?.bind(iterator);
    const onReturn = returnFn
        ? () => callIgnoringErrors(returnFn)
        : () => Promise.resolve();
    const onThrow = throwFn
        ? (reason) => callIgnoringErrors(() => throwFn(reason))
        : onReturn;
    return (0, withConcurrentAbruptClose_ts_1.withConcurrentAbruptClose)(mapAsyncIterableImpl(iterable, callback), onReturn, onThrow);
}
async function callIgnoringErrors(fn) {
    try {
        await fn();
    }
    catch {
    }
}
async function* mapAsyncIterableImpl(iterable, mapFn) {
    for await (const value of iterable) {
        const result = mapFn(value);
        if ((0, isPromise_ts_1.isPromiseLike)(result)) {
            yield await result;
            continue;
        }
        yield result;
    }
}
//# sourceMappingURL=mapAsyncIterable.js.map