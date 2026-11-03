export class AbortedGraphQLExecutionError extends Error {
    constructor(reason, result) {
        super(getAbortReasonMessage(reason), { cause: reason });
        this.name = 'AbortedGraphQLExecutionError';
        this.abortedResult = result;
    }
    get [Symbol.toStringTag]() {
        return 'AbortedGraphQLExecutionError';
    }
}
function getAbortReasonMessage(reason) {
    if (reason instanceof Error) {
        return reason.message;
    }
    if (typeof reason === 'object' &&
        reason !== null &&
        'message' in reason &&
        typeof reason.message === 'string') {
        return reason.message;
    }
    return String(reason);
}
//# sourceMappingURL=AbortedGraphQLExecutionError.mjs.map