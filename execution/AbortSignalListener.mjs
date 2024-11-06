import { promiseWithResolvers } from "../jsutils/promiseWithResolvers.mjs";
/**
 * A AbortSignalListener object can be used to trigger multiple responses
 * in response to a single AbortSignal.
 *
 * @internal
 */
export class AbortSignalListener {
    constructor(abortSignal) {
        this.abortSignal = abortSignal;
        this._onAborts = new Set();
        this.abort = () => {
            for (const abort of this._onAborts) {
                abort();
            }
        };
        abortSignal.addEventListener('abort', this.abort);
    }
    add(onAbort) {
        this._onAborts.add(onAbort);
    }
    delete(onAbort) {
        this._onAborts.delete(onAbort);
    }
    disconnect() {
        this.abortSignal.removeEventListener('abort', this.abort);
    }
}
export function cancellablePromise(originalPromise, abortSignalListener) {
    const abortSignal = abortSignalListener.abortSignal;
    if (abortSignal.aborted) {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        return Promise.reject(abortSignal.reason);
    }
    const { promise, resolve, reject } = promiseWithResolvers();
    const onAbort = () => reject(abortSignal.reason);
    abortSignalListener.add(onAbort);
    originalPromise.then((resolved) => {
        abortSignalListener.delete(onAbort);
        resolve(resolved);
    }, (error) => {
        abortSignalListener.delete(onAbort);
        reject(error);
    });
    return promise;
}
export function cancellableIterable(iterable, abortSignalListener) {
    const iterator = iterable[Symbol.asyncIterator]();
    const _next = iterator.next.bind(iterator);
    if (iterator.return) {
        const _return = iterator.return.bind(iterator);
        return {
            [Symbol.asyncIterator]: () => ({
                next: () => cancellablePromise(_next(), abortSignalListener),
                return: () => cancellablePromise(_return(), abortSignalListener),
            }),
        };
    }
    return {
        [Symbol.asyncIterator]: () => ({
            next: () => cancellablePromise(_next(), abortSignalListener),
        }),
    };
}
//# sourceMappingURL=AbortSignalListener.js.map