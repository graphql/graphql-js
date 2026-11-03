function runHookSafely(hook, info) {
    try {
        hook?.(info);
    }
    catch {
    }
}
export function runAsyncWorkFinishedHook(validatedExecutionArgs, sharedExecutionContext, asyncWorkFinishedHook) {
    const maybeWaitForAsyncWork = sharedExecutionContext.asyncWorkTracker.wait();
    if (maybeWaitForAsyncWork === undefined) {
        runHookSafely(asyncWorkFinishedHook, { validatedExecutionArgs });
        return;
    }
    maybeWaitForAsyncWork
        .then(() => {
        runHookSafely(asyncWorkFinishedHook, { validatedExecutionArgs });
    })
        .catch(() => undefined);
}
//# sourceMappingURL=hooks.mjs.map