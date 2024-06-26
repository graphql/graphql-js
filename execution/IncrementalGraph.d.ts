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
  private _deferredFragmentNodes;
  private _completedQueue;
  private _nextQueue;
  constructor();
  getNewRootNodes(
    incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
  ): ReadonlyArray<SubsequentResultRecord>;
  addCompletedReconcilableDeferredGroupedFieldSet(
    reconcilableResult: ReconcilableDeferredGroupedFieldSetResult,
  ): void;
  completedIncrementalData(): {
    [Symbol.asyncIterator](): any;
    next: () => Promise<IteratorResult<Iterable<IncrementalDataRecordResult>>>;
    return: () => Promise<
      IteratorResult<Iterable<IncrementalDataRecordResult>>
    >;
  };
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
  private _fragmentsToNodes;
  private _addDeferredFragmentNode;
  private _onDeferredGroupedFieldSet;
  private _onStreamItems;
  private _yieldCurrentCompletedIncrementalData;
  private _enqueue;
}
