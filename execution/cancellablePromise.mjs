import { promiseWithResolvers } from "../jsutils/promiseWithResolvers.mjs";
export function withCancellation(originalPromise) {
    const { promise, resolve, reject } = promiseWithResolvers();
    let settled = false;
    const settleResolve = (value) => {
        if (settled) {
            return;
        }
        settled = true;
        resolve(value);
    };
    const settleReject = (error) => {
        if (settled) {
            return;
        }
        settled = true;
        reject(error);
    };
    originalPromise.then(settleResolve, settleReject);
    return {
        promise,
        abort(reason) {
            settleReject(reason);
        },
    };
}
export function cancellablePromise(promise, abortSignal) {
    const withAbort = withCancellation(promise);
    if (abortSignal.aborted) {
        withAbort.abort(abortSignal.reason);
        return withAbort.promise;
    }
    const onAbort = () => {
        abortSignal.removeEventListener('abort', onAbort);
        withAbort.abort(abortSignal.reason);
    };
    abortSignal.addEventListener('abort', onAbort);
    withAbort.promise.then(() => {
        abortSignal.removeEventListener('abort', onAbort);
    }, () => {
        abortSignal.removeEventListener('abort', onAbort);
    });
    return withAbort.promise;
}
//# sourceMappingURL=cancellablePromise.mjs.map