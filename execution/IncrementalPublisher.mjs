import { invariant } from "../jsutils/invariant.mjs";
import { pathToArray } from "../jsutils/Path.mjs";
import { IncrementalGraph } from "./IncrementalGraph.mjs";
import { isCancellableStreamRecord, isCompletedExecutionGroup, isFailedExecutionGroup, } from "./types.mjs";
export function buildIncrementalResponse(context, result, errors, incrementalDataRecords) {
    const incrementalPublisher = new IncrementalPublisher(context);
    return incrementalPublisher.buildResponse(result, errors, incrementalDataRecords);
}
/**
 * This class is used to publish incremental results to the client, enabling semi-concurrent
 * execution while preserving result order.
 *
 * @internal
 */
class IncrementalPublisher {
    constructor(context) {
        this._context = context;
        this._nextId = 0;
        this._incrementalGraph = new IncrementalGraph();
    }
    buildResponse(data, errors, incrementalDataRecords) {
        const newRootNodes = this._incrementalGraph.getNewRootNodes(incrementalDataRecords);
        const pending = this._toPendingResults(newRootNodes);
        const initialResult = errors === undefined
            ? { data, pending, hasNext: true }
            : { errors, data, pending, hasNext: true };
        return {
            initialResult,
            subsequentResults: this._subscribe(),
        };
    }
    _toPendingResults(newRootNodes) {
        const pendingResults = [];
        for (const node of newRootNodes) {
            const id = String(this._getNextId());
            node.id = id;
            const pendingResult = {
                id,
                path: pathToArray(node.path),
            };
            if (node.label !== undefined) {
                pendingResult.label = node.label;
            }
            pendingResults.push(pendingResult);
        }
        return pendingResults;
    }
    _getNextId() {
        return String(this._nextId++);
    }
    _subscribe() {
        let isDone = false;
        const _next = async () => {
            if (isDone) {
                this._context.promiseCanceller?.disconnect();
                await this._returnAsyncIteratorsIgnoringErrors();
                return { value: undefined, done: true };
            }
            const context = {
                pending: [],
                incremental: [],
                completed: [],
            };
            let batch = this._incrementalGraph.currentCompletedBatch();
            do {
                for (const completedResult of batch) {
                    this._handleCompletedIncrementalData(completedResult, context);
                }
                const { incremental, completed } = context;
                if (incremental.length > 0 || completed.length > 0) {
                    const hasNext = this._incrementalGraph.hasNext();
                    if (!hasNext) {
                        isDone = true;
                    }
                    const subsequentIncrementalExecutionResult = { hasNext };
                    const pending = context.pending;
                    if (pending.length > 0) {
                        subsequentIncrementalExecutionResult.pending = pending;
                    }
                    if (incremental.length > 0) {
                        subsequentIncrementalExecutionResult.incremental = incremental;
                    }
                    if (completed.length > 0) {
                        subsequentIncrementalExecutionResult.completed = completed;
                    }
                    return { value: subsequentIncrementalExecutionResult, done: false };
                }
                // eslint-disable-next-line no-await-in-loop
                batch = await this._incrementalGraph.nextCompletedBatch();
            } while (batch !== undefined);
            // TODO: add test for this case
            /* c8 ignore next */
            this._context.promiseCanceller?.disconnect();
            await this._returnAsyncIteratorsIgnoringErrors();
            return { value: undefined, done: true };
        };
        const _return = async () => {
            isDone = true;
            this._incrementalGraph.abort();
            await this._returnAsyncIterators();
            return { value: undefined, done: true };
        };
        const _throw = async (error) => {
            isDone = true;
            this._incrementalGraph.abort();
            await this._returnAsyncIterators();
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            return Promise.reject(error);
        };
        return {
            [Symbol.asyncIterator]() {
                return this;
            },
            next: _next,
            return: _return,
            throw: _throw,
        };
    }
    _handleCompletedIncrementalData(completedIncrementalData, context) {
        if (isCompletedExecutionGroup(completedIncrementalData)) {
            this._handleCompletedExecutionGroup(completedIncrementalData, context);
        }
        else {
            this._handleCompletedStreamItems(completedIncrementalData, context);
        }
    }
    _handleCompletedExecutionGroup(completedExecutionGroup, context) {
        if (isFailedExecutionGroup(completedExecutionGroup)) {
            for (const deferredFragmentRecord of completedExecutionGroup
                .pendingExecutionGroup.deferredFragmentRecords) {
                const id = deferredFragmentRecord.id;
                if (!this._incrementalGraph.removeDeferredFragment(deferredFragmentRecord)) {
                    // This can occur if multiple deferred grouped field sets error for a fragment.
                    continue;
                }
                (id !== undefined) || invariant(false);
                context.completed.push({
                    id,
                    errors: completedExecutionGroup.errors,
                });
            }
            return;
        }
        this._incrementalGraph.addCompletedSuccessfulExecutionGroup(completedExecutionGroup);
        for (const deferredFragmentRecord of completedExecutionGroup
            .pendingExecutionGroup.deferredFragmentRecords) {
            const completion = this._incrementalGraph.completeDeferredFragment(deferredFragmentRecord);
            if (completion === undefined) {
                continue;
            }
            const id = deferredFragmentRecord.id;
            (id !== undefined) || invariant(false);
            const incremental = context.incremental;
            const { newRootNodes, successfulExecutionGroups } = completion;
            context.pending.push(...this._toPendingResults(newRootNodes));
            for (const successfulExecutionGroup of successfulExecutionGroups) {
                const { bestId, subPath } = this._getBestIdAndSubPath(id, deferredFragmentRecord, successfulExecutionGroup);
                const incrementalEntry = {
                    ...successfulExecutionGroup.result,
                    id: bestId,
                };
                if (subPath !== undefined) {
                    incrementalEntry.subPath = subPath;
                }
                incremental.push(incrementalEntry);
            }
            context.completed.push({ id });
        }
    }
    _handleCompletedStreamItems(streamItemsResult, context) {
        const streamRecord = streamItemsResult.streamRecord;
        const id = streamRecord.id;
        (id !== undefined) || invariant(false);
        if (streamItemsResult.errors !== undefined) {
            context.completed.push({
                id,
                errors: streamItemsResult.errors,
            });
            this._incrementalGraph.removeStream(streamRecord);
            if (isCancellableStreamRecord(streamRecord)) {
                (this._context.cancellableStreams !== undefined) || invariant(false);
                this._context.cancellableStreams.delete(streamRecord);
                streamRecord.earlyReturn().catch(() => {
                    /* c8 ignore next 1 */
                    // ignore error
                });
            }
        }
        else if (streamItemsResult.result === undefined) {
            context.completed.push({ id });
            this._incrementalGraph.removeStream(streamRecord);
            if (isCancellableStreamRecord(streamRecord)) {
                (this._context.cancellableStreams !== undefined) || invariant(false);
                this._context.cancellableStreams.delete(streamRecord);
            }
        }
        else {
            const incrementalEntry = {
                id,
                ...streamItemsResult.result,
            };
            context.incremental.push(incrementalEntry);
            const incrementalDataRecords = streamItemsResult.incrementalDataRecords;
            if (incrementalDataRecords !== undefined) {
                const newRootNodes = this._incrementalGraph.getNewRootNodes(incrementalDataRecords);
                context.pending.push(...this._toPendingResults(newRootNodes));
            }
        }
    }
    _getBestIdAndSubPath(initialId, initialDeferredFragmentRecord, completedExecutionGroup) {
        let maxLength = pathToArray(initialDeferredFragmentRecord.path).length;
        let bestId = initialId;
        for (const deferredFragmentRecord of completedExecutionGroup
            .pendingExecutionGroup.deferredFragmentRecords) {
            if (deferredFragmentRecord === initialDeferredFragmentRecord) {
                continue;
            }
            const id = deferredFragmentRecord.id;
            // TODO: add test case for when an fragment has not been released, but might be processed for the shortest path.
            /* c8 ignore next 3 */
            if (id === undefined) {
                continue;
            }
            const fragmentPath = pathToArray(deferredFragmentRecord.path);
            const length = fragmentPath.length;
            if (length > maxLength) {
                maxLength = length;
                bestId = id;
            }
        }
        const subPath = completedExecutionGroup.path.slice(maxLength);
        return {
            bestId,
            subPath: subPath.length > 0 ? subPath : undefined,
        };
    }
    async _returnAsyncIterators() {
        const cancellableStreams = this._context.cancellableStreams;
        if (cancellableStreams === undefined) {
            return;
        }
        const promises = [];
        for (const streamRecord of cancellableStreams) {
            if (streamRecord.earlyReturn !== undefined) {
                promises.push(streamRecord.earlyReturn());
            }
        }
        await Promise.all(promises);
    }
    async _returnAsyncIteratorsIgnoringErrors() {
        await this._returnAsyncIterators().catch(() => {
            // Ignore errors
        });
    }
}
//# sourceMappingURL=IncrementalPublisher.js.map