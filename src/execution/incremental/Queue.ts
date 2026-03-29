import { invariant } from '../../jsutils/invariant.js';
import { isPromise } from '../../jsutils/isPromise.js';
import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.js';
import { promiseWithResolvers } from '../../jsutils/promiseWithResolvers.js';

import { withConcurrentAbruptClose } from '../withConcurrentAbruptClose.js';

type Settled<T> =
  | { status: 'fulfilled'; value: T }
  | { status: 'rejected'; reason: unknown };

interface ItemEntry<T> {
  kind: 'item';
  settled?: Settled<T>;
}

interface StopEntry {
  kind: 'stop';
}

type Entry<T> = ItemEntry<T> | StopEntry;

interface BatchRequest<T> {
  resolve: (generator: Generator<T> | undefined) => void;
  reject: (reason: unknown) => void;
}

interface QueueExecutorOptions<T> {
  push: (item: PromiseOrValue<T>) => PromiseOrValue<void>;
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
export class Queue<T> {
  private _capacity: number;
  private _backlog = 0;
  private _waiters: Array<() => void> = [];
  private _entries: Array<Entry<T>> = [];
  private _isStopped = false;
  private _stopRequested = false;
  private _stopCleanupCallbacks: Array<
    (reason?: unknown) => PromiseOrValue<void>
  > = [];
  private _stopCompletion: Promise<void> | undefined;
  private _batchRequests = new Set<BatchRequest<T>>();

  private _resolveStarted: () => void;

  constructor(
    executor: ({
      push,
      stop,
      onStop,
      started,
    }: QueueExecutorOptions<T>) => PromiseOrValue<void>,
    initialCapacity = 1,
  ) {
    this._capacity = this._normalizeCapacity(initialCapacity);

    const { promise: started, resolve: resolveStarted } =
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();

    this._resolveStarted = resolveStarted;

    try {
      const result = executor({
        push: this._push.bind(this),
        stop: this._stop.bind(this),
        onStop: this._onStop.bind(this),
        started,
      });
      if (isPromise(result)) {
        result.catch((error: unknown) => this._stop(error));
      }
    } catch (error) {
      const stopped = this._stop(error);
      if (isPromise(stopped)) {
        stopped.catch(() => undefined);
      }
    }
  }

  subscribe<U>(
    reducer: (
      generator: Generator<T, void, void>,
    ) => PromiseOrValue<U | undefined> = (generator) =>
      Array.from(generator) as U,
  ): AsyncGenerator<U, void, void> {
    const generator = this._iteratorLoop(reducer);
    return withConcurrentAbruptClose(
      generator,
      () => this.cancel(),
      (error) => this.abort(error),
    );
  }

  cancel(): PromiseOrValue<void> {
    if (this._stopRequested) {
      return this._stopCompletion;
    }
    return this._terminate(undefined, () => {
      this._isStopped = true;
      this._batchRequests.forEach((request) => request.resolve(undefined));
      this._batchRequests.clear();
    });
  }

  abort(reason?: unknown): PromiseOrValue<void> {
    if (this._stopRequested) {
      return this._stopCompletion;
    }
    return this._terminate(reason, () => {
      this._isStopped = true;
      if (this._batchRequests.size) {
        this._batchRequests.forEach((request) => request.reject(reason));
        this._batchRequests.clear();
        return;
      }
      // save rejection for later batch requests
      this._entries.push({
        kind: 'item',
        settled: { status: 'rejected', reason },
      });
    });
  }

  async forEachBatch(
    reducer: (generator: Generator<T, void, void>) => PromiseOrValue<void>,
  ): Promise<void> {
    const sub = this.subscribe(async (generator) => {
      const { promise: drained, resolve } =
        // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
        promiseWithResolvers<void>();

      const wrappedBatch = (function* wrapper(): Generator<T> {
        yield* generator;
        resolve();
      })();

      await Promise.all([reducer(wrappedBatch), drained]);
    });

    for await (const _ of sub /* c8 ignore start */) {
      // intentionally empty
    } /* c8 ignore stop */
  }

  setCapacity(nextCapacity: number): void {
    this._capacity = this._normalizeCapacity(nextCapacity);
    this._flush();
  }

  getCapacity(): number {
    return this._capacity;
  }

  isStopped(): boolean {
    return this._isStopped;
  }

  private _normalizeCapacity(capacity: number): number {
    return Math.max(1, Math.floor(capacity));
  }

  private _flush(): void {
    while (this._waiters.length > 0 && this._backlog < this._capacity) {
      this._waiters.shift()?.();
    }
  }

  private _reserve(): PromiseOrValue<void> {
    this._backlog += 1;
    if (this._backlog < this._capacity) {
      return undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    const { promise, resolve } = promiseWithResolvers<void>();
    this._waiters.push(resolve);
    return promise;
  }

  private _release(): void {
    if (this._backlog > 0) {
      this._backlog -= 1;
    }
    this._flush();
  }

  private _onStop(cleanup: (reason?: unknown) => PromiseOrValue<void>): void {
    if (this._stopRequested) {
      throw new Error(
        'Cannot register onStop cleanup after stop has been requested.',
      );
    }
    this._stopCleanupCallbacks.push(cleanup);
  }

  private _runStopCleanup(
    reason: unknown,
    afterCleanup: () => void,
  ): PromiseOrValue<void> {
    this._stopRequested = true;
    const cleanupPromises = this._stopCleanupCallbacks.flatMap(
      (cleanupCallback): Array<Promise<unknown>> => {
        try {
          const result = cleanupCallback(reason);
          return isPromise(result) ? [result] : [];
        } /* c8 ignore start */ catch {
          // ignore errors
          return [];
        } /* c8 ignore stop */
      },
    );
    const cleanup =
      cleanupPromises.length > 0
        ? Promise.allSettled(cleanupPromises).then(() => undefined)
        : undefined;
    if (isPromise(cleanup)) {
      this._stopCompletion = cleanup
        .then(afterCleanup, afterCleanup)
        .then(() => undefined);
      return this._stopCompletion;
    }
    afterCleanup();
  }

  private async *_iteratorLoop<U>(
    reducer: (
      generator: Generator<T, void, void>,
    ) => PromiseOrValue<U | undefined>,
  ): AsyncGenerator<U, void, void> {
    this._resolveStarted();
    let nextBatch: Generator<T> | undefined;
    // eslint-disable-next-line no-await-in-loop
    while ((nextBatch = await this._waitForNextBatch())) {
      let reduced = reducer(nextBatch);
      if (isPromise(reduced)) {
        // eslint-disable-next-line no-await-in-loop
        reduced = await reduced;
      }
      if (reduced === undefined) {
        continue;
      }
      yield reduced;
    }
  }

  private _waitForNextBatch(): Promise<Generator<T> | undefined> {
    const { promise, resolve, reject } = promiseWithResolvers<
      Generator<T> | undefined
    >();
    this._batchRequests.add({ resolve, reject });
    this._deliverBatchIfReady();
    return promise;
  }

  private _push(item: PromiseOrValue<T>): PromiseOrValue<void> {
    if (this._stopRequested) {
      return;
    }
    const maybePushPromise = this._reserve();
    if (isPromise(item)) {
      const entry: ItemEntry<T> = { kind: 'item' };
      this._entries.push(entry);
      item.then(
        (resolved) => {
          entry.settled = { status: 'fulfilled', value: resolved };
          this._deliverBatchIfReady();
        },
        (reason: unknown) => {
          entry.settled = { status: 'rejected', reason };
          this._deliverBatchIfReady();
        },
      );
    } else {
      this._entries.push({
        kind: 'item',
        settled: { status: 'fulfilled', value: item },
      });
      this._deliverBatchIfReady();
    }
    return maybePushPromise;
  }

  private _terminate(
    reason: unknown,
    afterCleanup: () => void,
  ): PromiseOrValue<void> {
    for (const entry of this._entries) {
      if (entry.kind === 'item') {
        this._release();
      }
    }
    this._entries.length = 0;
    return this._runStopCleanup(reason, afterCleanup);
  }

  private _stop(reason?: unknown): PromiseOrValue<void> {
    if (this._stopRequested) {
      return this._stopCompletion;
    }
    const stopCompletion = this._runStopCleanup(reason, () => {
      if (reason === undefined) {
        if (this._entries.length === 0) {
          this._isStopped = true;
          this._deliverBatchIfReady();
          return;
        }

        this._entries.push({ kind: 'stop' });
        this._deliverBatchIfReady();
        return;
      }

      this._entries.push({
        kind: 'item',
        settled: { status: 'rejected', reason },
      });
      this._entries.push({ kind: 'stop' });
      this._deliverBatchIfReady();
    });

    if (isPromise(stopCompletion)) {
      stopCompletion.catch(() => undefined);
    }
    return stopCompletion;
  }

  private _deliverBatchIfReady(): void {
    if (!this._batchRequests.size) {
      return;
    }
    const headEntry = this._entries[0];
    const requests = this._batchRequests;
    if (headEntry !== undefined) {
      // stop sentinel always follows other work
      invariant(headEntry.kind !== 'stop');

      const settled = headEntry.settled;
      if (settled !== undefined) {
        if (settled.status === 'fulfilled') {
          this._batchRequests = new Set();
          requests.forEach((request) => request.resolve(this._drainBatch()));
          return;
        }
        this._entries.shift();
        this._release();
        this._isStopped = true;
        this._batchRequests = new Set();
        requests.forEach((request) => request.reject(settled.reason));
      }
    } else if (this._isStopped) {
      this._batchRequests = new Set();
      requests.forEach((request) => request.resolve(undefined));
    }
  }

  private *_drainBatch(): Generator<T> {
    while (true) {
      const entry = this._entries[0];
      if (entry === undefined) {
        return;
      }
      if (entry.kind === 'stop') {
        this._isStopped = true;
        this._entries.shift();
        return;
      }
      const settled = entry.settled;
      if (settled === undefined || settled.status === 'rejected') {
        return;
      }
      this._entries.shift();
      this._release();
      yield settled.value;
    }
  }
}
