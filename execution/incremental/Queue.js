"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Queue = void 0;
const invariant_ts_1 = require("../../jsutils/invariant.js");
const isPromise_ts_1 = require("../../jsutils/isPromise.js");
const promiseWithResolvers_ts_1 = require("../../jsutils/promiseWithResolvers.js");
const withConcurrentAbruptClose_ts_1 = require("../withConcurrentAbruptClose.js");
class Queue {
    constructor(executor, initialCapacity = 1) {
        this._backlog = 0;
        this._waiters = [];
        this._entries = [];
        this._isStopped = false;
        this._stopRequested = false;
        this._stopCleanupCallbacks = [];
        this._batchRequests = new Set();
        this._capacity = this._normalizeCapacity(initialCapacity);
        const { promise: started, resolve: resolveStarted } = (0, promiseWithResolvers_ts_1.promiseWithResolvers)();
        this._resolveStarted = resolveStarted;
        try {
            const result = executor({
                push: this._push.bind(this),
                stop: this._stop.bind(this),
                onStop: this._onStop.bind(this),
                started,
            });
            if ((0, isPromise_ts_1.isPromiseLike)(result)) {
                result.then(undefined, this._stop.bind(this));
            }
        }
        catch (error) {
            const stopped = this._stop(error);
            if ((0, isPromise_ts_1.isPromise)(stopped)) {
                stopped.catch(() => undefined);
            }
        }
    }
    subscribe(reducer = (generator) => Array.from(generator)) {
        const generator = this._iteratorLoop(reducer);
        return (0, withConcurrentAbruptClose_ts_1.withConcurrentAbruptClose)(generator, () => this.cancel(), this.abort.bind(this));
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
            const { promise: drained, resolve } = (0, promiseWithResolvers_ts_1.promiseWithResolvers)();
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
        const { promise, resolve } = (0, promiseWithResolvers_ts_1.promiseWithResolvers)();
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
                return (0, isPromise_ts_1.isPromiseLike)(result) ? [result] : [];
            }
            catch {
                return [];
            }
        });
        const cleanup = cleanupPromises.length > 0
            ? Promise.allSettled(cleanupPromises).then(() => undefined)
            : undefined;
        if ((0, isPromise_ts_1.isPromise)(cleanup)) {
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
            if ((0, isPromise_ts_1.isPromiseLike)(reduced)) {
                reduced = await reduced;
            }
            if (reduced === undefined) {
                continue;
            }
            yield reduced;
        }
    }
    _waitForNextBatch() {
        const { promise, resolve, reject } = (0, promiseWithResolvers_ts_1.promiseWithResolvers)();
        this._batchRequests.add({ resolve, reject });
        this._deliverBatchIfReady();
        return promise;
    }
    _push(item) {
        if (this._stopRequested) {
            return;
        }
        const maybePushPromise = this._reserve();
        if ((0, isPromise_ts_1.isPromiseLike)(item)) {
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
        if ((0, isPromise_ts_1.isPromise)(stopCompletion)) {
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
                (0, invariant_ts_1.invariant)(false);
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
exports.Queue = Queue;
//# sourceMappingURL=Queue.js.map