/**
 * A PromiseCanceller object can be used to trigger multiple responses
 * in response to a single AbortSignal.
 *
 * @internal
 */
export declare class PromiseCanceller {
    abortSignal: AbortSignal;
    abort: () => void;
    private _aborts;
    constructor(abortSignal: AbortSignal);
    disconnect(): void;
    cancellablePromise<T>(originalPromise: Promise<T>): Promise<T>;
    cancellableIterable<T>(iterable: AsyncIterable<T>): AsyncIterable<T>;
}
