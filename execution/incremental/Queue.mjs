import { invariant } from "../../jsutils/invariant.mjs";
import { isPromise } from "../../jsutils/isPromise.mjs";
import { promiseWithResolvers } from "../../jsutils/promiseWithResolvers.mjs";
import { withConcurrentAbruptClose } from "../withConcurrentAbruptClose.mjs";
export class Queue {
    constructor(executor, initialCapacity = 1) {
        this._backlog = 0;
        this._waiters = [];
        this._entries = [];
        this._isStopped = false;
        this._stopRequested = false;
        this._stopCleanupCallbacks = [];
        this._batchRequests = new Set();
        this._capacity = this._normalizeCapacity(initialCapacity);
        const { promise: started, resolve: resolveStarted } = promiseWithResolvers();
        this._resolveStarted = resolveStarted;
        try {
            const result = executor({
                push: this._push.bind(this),
                stop: this._stop.bind(this),
                onStop: this._onStop.bind(this),
                started,
            });
            if (isPromise(result)) {
                result.catch(this._stop.bind(this));
            }
        }
        catch (error) {
            const stopped = this._stop(error);
            if (isPromise(stopped)) {
                stopped.catch(() => undefined);
            }
        }
    }
    subscribe(reducer = (generator) => Array.from(generator)) {
        const generator = this._iteratorLoop(reducer);
        return withConcurrentAbruptClose(generator, () => this.cancel(), this.abort.bind(this));
    }
    cancel() {
        if (this._stopRequested) {
            return this._stopCompletion;
        }
        return this._terminate(undefined, () => {
            this._isStopped = true;
            this._batchRequests.forEach((request) => request.resolve(undefined));
            this._batchRequests.clear();
        });
    }
    abort(reason) {
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
            this._entries.push({
                kind: 'item',
                settled: { status: 'rejected', reason },
            });
        });
    }
    async forEachBatch(reducer) {
        const sub = this.subscribe(async (generator) => {
            const { promise: drained, resolve } = promiseWithResolvers();
            const wrappedBatch = (function* wrapper() {
                yield* generator;
                resolve();
            })();
            await Promise.all([reducer(wrappedBatch), drained]);
        });
        for await (const _ of sub) {
        }
    }
    setCapacity(nextCapacity) {
        this._capacity = this._normalizeCapacity(nextCapacity);
        this._flush();
    }
    getCapacity() {
        return this._capacity;
    }
    isStopped() {
        return this._isStopped;
    }
    _normalizeCapacity(capacity) {
        return Math.max(1, Math.floor(capacity));
    }
    _flush() {
        while (this._waiters.length > 0 && this._backlog < this._capacity) {
            this._waiters.shift()?.();
        }
    }
    _reserve() {
        this._backlog += 1;
        if (this._backlog < this._capacity) {
            return undefined;
        }
        const { promise, resolve } = promiseWithResolvers();
        this._waiters.push(resolve);
        return promise;
    }
    _release() {
        if (this._backlog > 0) {
            this._backlog -= 1;
        }
        this._flush();
    }
    _onStop(cleanup) {
        if (this._stopRequested) {
            throw new Error('Cannot register onStop cleanup after stop has been requested.');
        }
        this._stopCleanupCallbacks.push(cleanup);
    }
    _runStopCleanup(reason, afterCleanup) {
        this._stopRequested = true;
        const cleanupPromises = this._stopCleanupCallbacks.flatMap((cleanupCallback) => {
            try {
                const result = cleanupCallback(reason);
                return isPromise(result) ? [result] : [];
            }
            catch {
                return [];
            }
        });
        const cleanup = cleanupPromises.length > 0
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
    async *_iteratorLoop(reducer) {
        this._resolveStarted();
        let nextBatch;
        while ((nextBatch = await this._waitForNextBatch())) {
            let reduced = reducer(nextBatch);
            if (isPromise(reduced)) {
                reduced = await reduced;
            }
            if (reduced === undefined) {
                continue;
            }
            yield reduced;
        }
    }
    _waitForNextBatch() {
        const { promise, resolve, reject } = promiseWithResolvers();
        this._batchRequests.add({ resolve, reject });
        this._deliverBatchIfReady();
        return promise;
    }
    _push(item) {
        if (this._stopRequested) {
            return;
        }
        const maybePushPromise = this._reserve();
        if (isPromise(item)) {
            const entry = { kind: 'item' };
            this._entries.push(entry);
            item.then((resolved) => {
                entry.settled = { status: 'fulfilled', value: resolved };
                this._deliverBatchIfReady();
            }, (reason) => {
                entry.settled = { status: 'rejected', reason };
                this._deliverBatchIfReady();
            });
        }
        else {
            this._entries.push({
                kind: 'item',
                settled: { status: 'fulfilled', value: item },
            });
            this._deliverBatchIfReady();
        }
        return maybePushPromise;
    }
    _terminate(reason, afterCleanup) {
        for (const entry of this._entries) {
            if (entry.kind === 'item') {
                this._release();
            }
        }
        this._entries.length = 0;
        return this._runStopCleanup(reason, afterCleanup);
    }
    _stop(reason) {
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
    _deliverBatchIfReady() {
        if (!this._batchRequests.size) {
            return;
        }
        const headEntry = this._entries[0];
        const requests = this._batchRequests;
        if (headEntry !== undefined) {
            if (!(headEntry.kind !== 'stop'))
                invariant(false);
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
        }
        else if (this._isStopped) {
            this._batchRequests = new Set();
            requests.forEach((request) => request.resolve(undefined));
        }
    }
    *_drainBatch() {
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
//# sourceMappingURL=Queue.mjs.map