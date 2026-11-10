import type { PromiseOrValue } from "../../jsutils/PromiseOrValue.mjs";
interface QueueExecutorOptions<T> {
    push: (item: PromiseLike<T> | T) => PromiseOrValue<void>;
    stop: (reason?: unknown) => PromiseOrValue<void>;
    onStop: (cleanup: (reason?: unknown) => PromiseOrValue<void>) => void;
    started: Promise<void>;
}
/**
 * A Queue is a lightweight async-generator primitive inspired by Brian Kim's
 * Repeater (https://repeater.js.org, https://github.com/repeaterjs/repeater).
 * The ergonomics are similar, but this implementation favors clarity over
 * performance and gives producers flexibility to remain lazy, become eager, or
 * live somewhere in between.
 *
 * The constructor takes an executor function and an optional `initialCapacity`.
 * Executors receive `{ push, stop, onStop, started }` and may return `void` or
 * a promise if they perform asynchronous setup. They call `push` whenever
 * another item is ready, call `stop` when no more values will be produced
 * (optionally supplying an error), register stop-time cleanup via `onStop`,
 * and await `started` when setup should run only after iteration begins.
 * Because `push`, `stop`, and `onStop` are plain functions, executors can
 * hoist them into outside scopes or pass them to helpers. If the executor
 * throws or its returned promise rejects, the queue treats it as `stop(error)`
 * and propagates the failure.
 *
 * The `initialCapacity` argument (default `1`) governs backpressure. Capacity
 * is the maximum number of buffered items allowed before a push must wait.
 * When the backlog reaches capacity, `push` returns a promise that settles
 * once consumption releases space; otherwise it returns `undefined`. Setting
 * capacity to `1` yields a fully lazy queue (every push waits unless a prior
 * item has been consumed); higher capacities buffer that many items eagerly.
 * Capacity can be changed later via `setCapacity` and observed via
 * `getCapacity`.
 *
 * `subscribe(reducer)` returns an async generator whose batches feed a generator
 * of settled values into the reducer; whatever the reducer returns (other than
 * `undefined`) becomes the yielded value for that batch. Calling `return()` on
 * the subscription settles pending `next` calls thanks to `withConcurrent`,
 * providing direct abort semantics rather than leaving `next()` suspended.
 *
 * 'forEachBatch(reducer)` is a convenience method that subscribes with the
 * given reducer and runs it for each batch until the queue stops.
 *
 * Producers can stay lazy by awaiting `started`, using zero capacity, and
 * awaiting each `push`. Skipping those waits while raising capacity makes the
 * queue eager up to its configured limit. The `isStopped()` helper exposes
 * whether the queue has fully stopped, which can be useful when the reducer
 * function actually performs external work and wants to bail early without
 * awaiting another `next`.
 *
 * @internal
 */
export declare class Queue<T> {
    private _capacity;
    private _backlog;
    private _waiters;
    private _entries;
    private _isStopped;
    private _stopRequested;
    private _stopCleanupCallbacks;
    private _stopCompletion;
    private _batchRequests;
    private _resolveStarted;
    constructor(executor: ({ push, stop, onStop, started, }: QueueExecutorOptions<T>) => PromiseOrValue<void>, initialCapacity?: number);
    subscribe<U>(reducer?: (generator: Generator<T, void, void>) => PromiseOrValue<U | undefined>): AsyncGenerator<U, void, void>;
    cancel(): PromiseOrValue<void>;
    abort(reason?: unknown): PromiseOrValue<void>;
    forEachBatch(reducer: (generator: Generator<T, void, void>) => PromiseOrValue<void>): Promise<void>;
    setCapacity(nextCapacity: number): void;
    getCapacity(): number;
    isStopped(): boolean;
    private _normalizeCapacity;
    private _flush;
    private _reserve;
    private _release;
    private _onStop;
    private _runStopCleanup;
    private _iteratorLoop;
    private _waitForNextBatch;
    private _push;
    private _terminate;
    private _stop;
    private _deliverBatchIfReady;
    private _drainBatch;
}
export {};
