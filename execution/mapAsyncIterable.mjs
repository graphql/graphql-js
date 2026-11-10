import { isPromiseLike } from "../jsutils/isPromise.mjs";
import { withConcurrentAbruptClose } from "./withConcurrentAbruptClose.mjs";
export function mapAsyncIterable(iterable, callback) {
    const iterator = iterable[Symbol.asyncIterator]();
    const returnFn = iterator.return?.bind(iterator);
    const throwFn = iterator.throw?.bind(iterator);
    const onReturn = returnFn
        ? () => callIgnoringErrors(returnFn)
        : () => Promise.resolve();
    const onThrow = throwFn
        ? (reason) => callIgnoringErrors(() => throwFn(reason))
        : onReturn;
    return withConcurrentAbruptClose(mapAsyncIterableImpl(iterable, callback), onReturn, onThrow);
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
        if (isPromiseLike(result)) {
            yield await result;
            continue;
        }
        yield result;
    }
}
//# sourceMappingURL=mapAsyncIterable.mjs.map