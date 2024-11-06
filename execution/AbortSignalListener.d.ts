/**
 * A AbortSignalListener object can be used to trigger multiple responses
 * in response to a single AbortSignal.
 *
 * @internal
 */
export declare class AbortSignalListener {
    abortSignal: AbortSignal;
    abort: () => void;
    private _onAborts;
    constructor(abortSignal: AbortSignal);
    add(onAbort: () => void): void;
    delete(onAbort: () => void): void;
    disconnect(): void;
}
export declare function cancellablePromise<T>(originalPromise: Promise<T>, abortSignalListener: AbortSignalListener): Promise<T>;
export declare function cancellableIterable<T>(iterable: AsyncIterable<T>, abortSignalListener: AbortSignalListener): AsyncIterable<T>;
