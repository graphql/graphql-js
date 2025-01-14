"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapAsyncIterable = mapAsyncIterable;
/**
 * Given an AsyncIterable and a callback function, return an AsyncIterator
 * which produces values mapped via calling the callback function.
 */
function mapAsyncIterable(iterable, callback, onDone) {
    const iterator = iterable[Symbol.asyncIterator]();
    async function mapResult(promise) {
        let value;
        try {
            const result = await promise;
            if (result.done) {
                onDone?.();
                return result;
            }
            value = result.value;
        }
        catch (error) {
            onDone?.();
            throw error;
        }
        try {
            return { value: await callback(value), done: false };
        }
        catch (error) {
            /* c8 ignore start */
            // FIXME: add test case
            if (typeof iterator.return === 'function') {
                try {
                    await iterator.return();
                }
                catch (_e) {
                    /* ignore error */
                }
            }
            throw error;
            /* c8 ignore stop */
        }
    }
    return {
        async next() {
            return mapResult(iterator.next());
        },
        async return() {
            // If iterator.return() does not exist, then type R must be undefined.
            return typeof iterator.return === 'function'
                ? mapResult(iterator.return())
                : { value: undefined, done: true };
        },
        async throw(error) {
            if (typeof iterator.throw === 'function') {
                return mapResult(iterator.throw(error));
            }
            throw error;
        },
        [Symbol.asyncIterator]() {
            return this;
        },
    };
}
//# sourceMappingURL=mapAsyncIterable.js.map