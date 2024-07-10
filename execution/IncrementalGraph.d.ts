import type {
  DeferredFragmentRecord,
  IncrementalDataRecord,
  IncrementalDataRecordResult,
  ReconcilableDeferredGroupedFieldSetResult,
  StreamRecord,
  SubsequentResultRecord,
} from './types.js';
/**
 * @internal
 */
export declare class IncrementalGraph {
  private _rootNodes;
  private _completedQueue;
  private _nextQueue;
  constructor();
  getNewRootNodes(
    incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
  ): ReadonlyArray<SubsequentResultRecord>;
  addCompletedReconcilableDeferredGroupedFieldSet(
    reconcilableResult: ReconcilableDeferredGroupedFieldSetResult,
  ): void;
  currentCompletedBatch(): Generator<IncrementalDataRecordResult>;
  nextCompletedBatch(): Promise<
    Iterable<IncrementalDataRecordResult> | undefined
  >;
  abort(): void;
  hasNext(): boolean;
  completeDeferredFragment(deferredFragmentRecord: DeferredFragmentRecord):
    | {
        newRootNodes: ReadonlyArray<SubsequentResultRecord>;
        reconcilableResults: ReadonlyArray<ReconcilableDeferredGroupedFieldSetResult>;
      }
    | undefined;
  removeDeferredFragment(
    deferredFragmentRecord: DeferredFragmentRecord,
  ): boolean;
  removeStream(streamRecord: StreamRecord): void;
  private _removeRootNode;
  private _addIncrementalDataRecords;
  private _promoteNonEmptyToRoot;
  private _completesRootNode;
  private _addDeferredFragment;
  private _onDeferredGroupedFieldSet;
  private _onStreamItems;
  private _yieldCurrentCompletedIncrementalData;
  private _enqueue;
}
