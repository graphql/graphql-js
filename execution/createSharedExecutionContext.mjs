import { AsyncWorkTracker } from "./AsyncWorkTracker.mjs";
export function createSharedExecutionContext(abortSignal) {
    const asyncWorkTracker = new AsyncWorkTracker();
    let resolveInfoHelpers;
    const promiseAll = (values) => asyncWorkTracker.promiseAllTrackOnReject(values);
    const getAsyncHelpers = () => (resolveInfoHelpers ??= {
        promiseAll,
        track: (maybePromises) => asyncWorkTracker.addValues(maybePromises),
    });
    return {
        asyncWorkTracker,
        getAbortSignal: () => abortSignal,
        getAsyncHelpers,
        promiseAll,
    };
}
//# sourceMappingURL=createSharedExecutionContext.mjs.map