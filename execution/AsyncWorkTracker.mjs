import { isPromiseLike } from "../jsutils/isPromise.mjs";
export class AsyncWorkTracker {
    constructor() {
        this.pendingAsyncWork = new Set();
    }
    add(promiseLike) {
        const pendingAsyncWork = this.pendingAsyncWork;
        const promiseToSettle = promiseLike.then(() => {
            pendingAsyncWork.delete(promiseToSettle);
        }, () => {
            pendingAsyncWork.delete(promiseToSettle);
        });
        pendingAsyncWork.add(promiseToSettle);
    }
    addValues(values) {
        for (const value of values) {
            if (isPromiseLike(value)) {
                this.add(value);
            }
        }
    }
    wait() {
        if (this.pendingAsyncWork.size === 0) {
            return;
        }
        return this.waitForPendingAsyncWork();
    }
    promiseAllTrackOnReject(values) {
        const promise = Promise.all(values);
        promise.then(undefined, () => {
            this.addValues(values);
        });
        return promise;
    }
    async waitForPendingAsyncWork() {
        while (this.pendingAsyncWork.size > 0) {
            await Promise.allSettled(Array.from(this.pendingAsyncWork));
        }
    }
}
//# sourceMappingURL=AsyncWorkTracker.mjs.map