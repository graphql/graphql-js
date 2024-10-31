import { promiseWithResolvers } from "../jsutils/promiseWithResolvers.mjs";
/**
 * A PromiseCanceller object can be used to cancel multiple promises
 * using a single AbortSignal.
 *
 * @internal
 */
export class PromiseCanceller {
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
    withCancellation(originalPromise) {
        if (this.abortSignal.aborted) {
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            return Promise.reject(this.abortSignal.reason);
        }
        const { promise, resolve, reject } = promiseWithResolvers();
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
}
//# sourceMappingURL=PromiseCanceller.js.map