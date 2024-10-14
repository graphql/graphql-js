import { BoxedPromiseOrValue } from "../jsutils/BoxedPromiseOrValue.mjs";
import { invariant } from "../jsutils/invariant.mjs";
import { isPromise } from "../jsutils/isPromise.mjs";
import { promiseWithResolvers } from "../jsutils/promiseWithResolvers.mjs";
import { isDeferredFragmentRecord, isPendingExecutionGroup } from "./types.mjs";
/**
 * @internal
 */
export class IncrementalGraph {
    constructor() {
        this._rootNodes = new Set();
        this._completedQueue = [];
        this._nextQueue = [];
    }
    getNewRootNodes(incrementalDataRecords) {
        const initialResultChildren = new Set();
        this._addIncrementalDataRecords(incrementalDataRecords, undefined, initialResultChildren);
        return this._promoteNonEmptyToRoot(initialResultChildren);
    }
    addCompletedSuccessfulExecutionGroup(successfulExecutionGroup) {
        const { pendingExecutionGroup, incrementalDataRecords } = successfulExecutionGroup;
        const deferredFragmentRecords = pendingExecutionGroup.deferredFragmentRecords;
        for (const deferredFragmentRecord of deferredFragmentRecords) {
            const { pendingExecutionGroups, successfulExecutionGroups } = deferredFragmentRecord;
            pendingExecutionGroups.delete(pendingExecutionGroup);
            successfulExecutionGroups.add(successfulExecutionGroup);
        }
        if (incrementalDataRecords !== undefined) {
            this._addIncrementalDataRecords(incrementalDataRecords, deferredFragmentRecords);
        }
    }
    *currentCompletedBatch() {
        let completed;
        while ((completed = this._completedQueue.shift()) !== undefined) {
            yield completed;
        }
        if (this._rootNodes.size === 0) {
            for (const resolve of this._nextQueue) {
                resolve(undefined);
            }
        }
    }
    nextCompletedBatch() {
        const { promise, resolve } = promiseWithResolvers();
        this._nextQueue.push(resolve);
        return promise;
    }
    abort() {
        for (const resolve of this._nextQueue) {
            resolve(undefined);
        }
    }
    hasNext() {
        return this._rootNodes.size > 0;
    }
    completeDeferredFragment(deferredFragmentRecord) {
        if (!this._rootNodes.has(deferredFragmentRecord) ||
            deferredFragmentRecord.pendingExecutionGroups.size > 0) {
            return;
        }
        const successfulExecutionGroups = Array.from(deferredFragmentRecord.successfulExecutionGroups);
        this._rootNodes.delete(deferredFragmentRecord);
        for (const successfulExecutionGroup of successfulExecutionGroups) {
            for (const otherDeferredFragmentRecord of successfulExecutionGroup
                .pendingExecutionGroup.deferredFragmentRecords) {
                otherDeferredFragmentRecord.successfulExecutionGroups.delete(successfulExecutionGroup);
            }
        }
        const newRootNodes = this._promoteNonEmptyToRoot(deferredFragmentRecord.children);
        return { newRootNodes, successfulExecutionGroups };
    }
    removeDeferredFragment(deferredFragmentRecord) {
        if (!this._rootNodes.has(deferredFragmentRecord)) {
            return false;
        }
        this._rootNodes.delete(deferredFragmentRecord);
        return true;
    }
    removeStream(streamRecord) {
        this._rootNodes.delete(streamRecord);
    }
    _addIncrementalDataRecords(incrementalDataRecords, parents, initialResultChildren) {
        for (const incrementalDataRecord of incrementalDataRecords) {
            if (isPendingExecutionGroup(incrementalDataRecord)) {
                for (const deferredFragmentRecord of incrementalDataRecord.deferredFragmentRecords) {
                    this._addDeferredFragment(deferredFragmentRecord, initialResultChildren);
                    deferredFragmentRecord.pendingExecutionGroups.add(incrementalDataRecord);
                }
                if (this._completesRootNode(incrementalDataRecord)) {
                    this._onExecutionGroup(incrementalDataRecord);
                }
            }
            else if (parents === undefined) {
                (initialResultChildren !== undefined) || invariant(false);
                initialResultChildren.add(incrementalDataRecord);
            }
            else {
                for (const parent of parents) {
                    this._addDeferredFragment(parent, initialResultChildren);
                    parent.children.add(incrementalDataRecord);
                }
            }
        }
    }
    _promoteNonEmptyToRoot(maybeEmptyNewRootNodes) {
        const newRootNodes = [];
        for (const node of maybeEmptyNewRootNodes) {
            if (isDeferredFragmentRecord(node)) {
                if (node.pendingExecutionGroups.size > 0) {
                    for (const pendingExecutionGroup of node.pendingExecutionGroups) {
                        if (!this._completesRootNode(pendingExecutionGroup)) {
                            this._onExecutionGroup(pendingExecutionGroup);
                        }
                    }
                    this._rootNodes.add(node);
                    newRootNodes.push(node);
                    continue;
                }
                for (const child of node.children) {
                    maybeEmptyNewRootNodes.add(child);
                }
            }
            else {
                this._rootNodes.add(node);
                newRootNodes.push(node);
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                this._onStreamItems(node);
            }
        }
        return newRootNodes;
    }
    _completesRootNode(pendingExecutionGroup) {
        return pendingExecutionGroup.deferredFragmentRecords.some((deferredFragmentRecord) => this._rootNodes.has(deferredFragmentRecord));
    }
    _addDeferredFragment(deferredFragmentRecord, initialResultChildren) {
        if (this._rootNodes.has(deferredFragmentRecord)) {
            return;
        }
        const parent = deferredFragmentRecord.parent;
        if (parent === undefined) {
            (initialResultChildren !== undefined) || invariant(false);
            initialResultChildren.add(deferredFragmentRecord);
            return;
        }
        parent.children.add(deferredFragmentRecord);
        this._addDeferredFragment(parent, initialResultChildren);
    }
    _onExecutionGroup(pendingExecutionGroup) {
        let completedExecutionGroup = pendingExecutionGroup.result;
        if (!(completedExecutionGroup instanceof BoxedPromiseOrValue)) {
            completedExecutionGroup = completedExecutionGroup();
        }
        const value = completedExecutionGroup.value;
        if (isPromise(value)) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            value.then((resolved) => this._enqueue(resolved));
        }
        else {
            this._enqueue(value);
        }
    }
    async _onStreamItems(streamRecord) {
        let items = [];
        let errors = [];
        let incrementalDataRecords = [];
        const streamItemQueue = streamRecord.streamItemQueue;
        let streamItemRecord;
        while ((streamItemRecord = streamItemQueue.shift()) !== undefined) {
            let result = streamItemRecord instanceof BoxedPromiseOrValue
                ? streamItemRecord.value
                : streamItemRecord().value;
            if (isPromise(result)) {
                if (items.length > 0) {
                    this._enqueue({
                        streamRecord,
                        result: 
                        // TODO add additional test case or rework for coverage
                        errors.length > 0 /* c8 ignore start */
                            ? { items, errors } /* c8 ignore stop */
                            : { items },
                        incrementalDataRecords,
                    });
                    items = [];
                    errors = [];
                    incrementalDataRecords = [];
                }
                // eslint-disable-next-line no-await-in-loop
                result = await result;
                // wait an additional tick to coalesce resolving additional promises
                // within the queue
                // eslint-disable-next-line no-await-in-loop
                await Promise.resolve();
            }
            if (result.item === undefined) {
                if (items.length > 0) {
                    this._enqueue({
                        streamRecord,
                        result: errors.length > 0 ? { items, errors } : { items },
                        incrementalDataRecords,
                    });
                }
                this._enqueue(result.errors === undefined
                    ? { streamRecord }
                    : {
                        streamRecord,
                        errors: result.errors,
                    });
                return;
            }
            items.push(result.item);
            if (result.errors !== undefined) {
                errors.push(...result.errors);
            }
            if (result.incrementalDataRecords !== undefined) {
                incrementalDataRecords.push(...result.incrementalDataRecords);
            }
        }
    }
    _enqueue(completed) {
        this._completedQueue.push(completed);
        const next = this._nextQueue.shift();
        if (next === undefined) {
            return;
        }
        next(this.currentCompletedBatch());
    }
}
//# sourceMappingURL=IncrementalGraph.js.map