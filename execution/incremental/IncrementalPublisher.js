"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncrementalPublisher = void 0;
const memoize1_ts_1 = require("../../jsutils/memoize1.js");
const Path_ts_1 = require("../../jsutils/Path.js");
const ensureGraphQLError_ts_1 = require("../../error/ensureGraphQLError.js");
const mapAsyncIterable_ts_1 = require("../mapAsyncIterable.js");
const withConcurrentAbruptClose_ts_1 = require("../withConcurrentAbruptClose.js");
const WorkQueue_ts_1 = require("./WorkQueue.js");
class IncrementalPublisher {
    constructor() {
        this._ids = new Map();
        this._nextId = 0;
        this._cachedPathToArray = (0, memoize1_ts_1.memoize1)((path) => (0, Path_ts_1.pathToArray)(path));
    }
    buildResponse(data, errors, work, abortSignal, onFinished) {
        const { initialGroups, initialStreams, events } = (0, WorkQueue_ts_1.createWorkQueue)(work);
        function abort() {
            subsequentResults.throw(abortSignal?.reason).catch(() => {
            });
        }
        if (abortSignal) {
            abortSignal.addEventListener('abort', abort);
        }
        const onWorkQueueFinished = () => {
            onFinished();
            abortSignal?.removeEventListener('abort', abort);
        };
        const pending = this._toPendingResults(initialGroups, initialStreams);
        const initialResult = errors.length
            ? { errors, data, pending, hasNext: true }
            : { data, pending, hasNext: true };
        const subsequentResults = (0, withConcurrentAbruptClose_ts_1.withConcurrentAbruptClose)((0, mapAsyncIterable_ts_1.mapAsyncIterable)(events, (batch) => this._handleBatch(batch, onWorkQueueFinished)), () => onWorkQueueFinished());
        return {
            initialResult,
            subsequentResults,
        };
    }
    _pathToArray(path) {
        if (path == null) {
            return [];
        }
        return this._cachedPathToArray(path);
    }
    _ensureId(deferredFragmentOrStream) {
        let id = this._ids.get(deferredFragmentOrStream);
        if (id !== undefined) {
            return id;
        }
        id = String(this._nextId++);
        this._ids.set(deferredFragmentOrStream, id);
        return id;
    }
    _toPendingResults(newGroups, newStreams) {
        const pendingResults = [];
        for (const collection of [newGroups, newStreams]) {
            for (const node of collection) {
                const id = this._ensureId(node);
                const pendingResult = {
                    id,
                    path: this._pathToArray(node.path),
                };
                if (node.label !== undefined) {
                    pendingResult.label = node.label;
                }
                pendingResults.push(pendingResult);
            }
        }
        return pendingResults;
    }
    _handleBatch(batch, onWorkQueueFinished) {
        const context = {
            pending: [],
            incremental: [],
            completed: [],
            hasNext: true,
        };
        for (const event of batch) {
            this._handleWorkQueueEvent(event, context, onWorkQueueFinished);
        }
        const { incremental, completed, pending, hasNext } = context;
        const result = { hasNext };
        if (pending.length > 0) {
            result.pending = pending;
        }
        if (incremental.length > 0) {
            result.incremental = incremental;
        }
        if (completed.length > 0) {
            result.completed = completed;
        }
        return result;
    }
    _handleWorkQueueEvent(event, context, onWorkQueueFinished) {
        switch (event.kind) {
            case 'GROUP_VALUES': {
                const group = event.group;
                const id = this._ensureId(group);
                for (const value of event.values) {
                    const { bestId, subPath } = this._getBestIdAndSubPath(id, group, value);
                    const incrementalEntry = {
                        id: bestId,
                        data: value.data,
                    };
                    if (value.errors !== undefined) {
                        incrementalEntry.errors = value.errors;
                    }
                    if (subPath !== undefined) {
                        incrementalEntry.subPath = subPath;
                    }
                    context.incremental.push(incrementalEntry);
                }
                break;
            }
            case 'GROUP_SUCCESS': {
                const group = event.group;
                const id = this._ensureId(group);
                context.completed.push({ id });
                this._ids.delete(group);
                if (event.newGroups.length > 0 || event.newStreams.length > 0) {
                    context.pending.push(...this._toPendingResults(event.newGroups, event.newStreams));
                }
                break;
            }
            case 'GROUP_FAILURE': {
                const { group, error } = event;
                const id = this._ensureId(group);
                context.completed.push({
                    id,
                    errors: [(0, ensureGraphQLError_ts_1.ensureGraphQLError)(error)],
                });
                this._ids.delete(group);
                break;
            }
            case 'STREAM_VALUES': {
                const stream = event.stream;
                const id = this._ensureId(stream);
                const { values, newGroups, newStreams } = event;
                const items = [];
                const errors = [];
                for (const value of values) {
                    items.push(value.item);
                    if (value.errors !== undefined) {
                        errors.push(...value.errors);
                    }
                }
                context.incremental.push(errors.length > 0 ? { id, items, errors } : { id, items });
                if (newGroups.length > 0 || newStreams.length > 0) {
                    context.pending.push(...this._toPendingResults(newGroups, newStreams));
                }
                break;
            }
            case 'STREAM_SUCCESS': {
                const stream = event.stream;
                context.completed.push({
                    id: this._ensureId(stream),
                });
                this._ids.delete(stream);
                break;
            }
            case 'STREAM_FAILURE': {
                const stream = event.stream;
                context.completed.push({
                    id: this._ensureId(stream),
                    errors: [(0, ensureGraphQLError_ts_1.ensureGraphQLError)(event.error)],
                });
                this._ids.delete(stream);
                break;
            }
            case 'WORK_QUEUE_TERMINATION': {
                onWorkQueueFinished?.();
                context.hasNext = false;
                break;
            }
        }
    }
    _getBestIdAndSubPath(initialId, initialDeferredFragmentRecord, executionGroupValue) {
        let maxLength = this._pathToArray(initialDeferredFragmentRecord.path).length;
        let bestId = initialId;
        for (const deliveryGroup of executionGroupValue.deliveryGroups) {
            if (deliveryGroup === initialDeferredFragmentRecord) {
                continue;
            }
            const id = this._ids.get(deliveryGroup);
            if (id === undefined) {
                continue;
            }
            const path = this._pathToArray(deliveryGroup.path);
            const length = path.length;
            if (length > maxLength) {
                maxLength = length;
                bestId = id;
            }
        }
        const subPath = executionGroupValue.path.slice(maxLength);
        return {
            bestId,
            subPath: subPath.length > 0 ? subPath : undefined,
        };
    }
}
exports.IncrementalPublisher = IncrementalPublisher;
//# sourceMappingURL=IncrementalPublisher.js.map