"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromiseCanceller = void 0;
const promiseWithResolvers_js_1 = require("../jsutils/promiseWithResolvers.js");
/**
 * A PromiseCanceller object can be used to trigger multiple responses
 * in response to a single AbortSignal.
 *
 * @internal
 */
class PromiseCanceller {
    constructor(abortSignal) {
        this.abortSignal = abortSignal;
        this._aborts = new Set();
        this.abort = () => {
            for (const abort of this._aborts) {
                abort();
            }
        };
        abortSignal.addEventListener('abort', this.abort);
    }
    disconnect() {
        this.abortSignal.removeEventListener('abort', this.abort);
    }
    cancellablePromise(originalPromise) {
        if (this.abortSignal.aborted) {
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            return Promise.reject(this.abortSignal.reason);
        }
        const { promise, resolve, reject } = (0, promiseWithResolvers_js_1.promiseWithResolvers)();
        const abort = () => reject(this.abortSignal.reason);
        this._aborts.add(abort);
        originalPromise.then((resolved) => {
            this._aborts.delete(abort);
            resolve(resolved);
        }, (error) => {
            this._aborts.delete(abort);
            reject(error);
        });
        return promise;
    }
    cancellableIterable(iterable) {
        const iterator = iterable[Symbol.asyncIterator]();
        const _next = iterator.next.bind(iterator);
        if (iterator.return) {
            const _return = iterator.return.bind(iterator);
            return {
                [Symbol.asyncIterator]: () => ({
                    next: () => this.cancellablePromise(_next()),
                    return: () => this.cancellablePromise(_return()),
                }),
            };
        }
        return {
            [Symbol.asyncIterator]: () => ({
                next: () => this.cancellablePromise(_next()),
            }),
        };
    }
}
exports.PromiseCanceller = PromiseCanceller;
//# sourceMappingURL=PromiseCanceller.js.map