/**
 * A PromiseCanceller object can be used to cancel multiple promises
 * using a single AbortSignal.
 *
 * @internal
 */
export declare class PromiseCanceller {
    abortSignal: AbortSignal;
    abort: () => void;
    private _aborts;
    constructor(abortSignal: AbortSignal);
    disconnect(): void;
    withCancellation<T>(originalPromise: Promise<T>): Promise<T>;
}
