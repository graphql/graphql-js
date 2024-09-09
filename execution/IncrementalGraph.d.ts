import type { DeferredFragmentRecord, DeliveryGroup, IncrementalDataRecord, IncrementalDataRecordResult, StreamRecord, SuccessfulExecutionGroup } from './types.js';
/**
 * @internal
 */
export declare class IncrementalGraph {
    private _rootNodes;
    private _completedQueue;
    private _nextQueue;
    constructor();
    getNewRootNodes(incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>): ReadonlyArray<DeliveryGroup>;
    addCompletedSuccessfulExecutionGroup(successfulExecutionGroup: SuccessfulExecutionGroup): void;
    currentCompletedBatch(): Generator<IncrementalDataRecordResult>;
    nextCompletedBatch(): Promise<Iterable<IncrementalDataRecordResult> | undefined>;
    abort(): void;
    hasNext(): boolean;
    completeDeferredFragment(deferredFragmentRecord: DeferredFragmentRecord): {
        newRootNodes: ReadonlyArray<DeliveryGroup>;
        successfulExecutionGroups: ReadonlyArray<SuccessfulExecutionGroup>;
    } | undefined;
    removeDeferredFragment(deferredFragmentRecord: DeferredFragmentRecord): boolean;
    removeStream(streamRecord: StreamRecord): void;
    private _addIncrementalDataRecords;
    private _promoteNonEmptyToRoot;
    private _completesRootNode;
    private _addDeferredFragment;
    private _onExecutionGroup;
    private _onStreamItems;
    private _enqueue;
}
