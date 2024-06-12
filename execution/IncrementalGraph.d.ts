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
  private _pending;
  private _deferredFragmentNodes;
  private _newPending;
  private _newIncrementalDataRecords;
  private _completedQueue;
  private _nextQueue;
  constructor();
  addIncrementalDataRecords(
    incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
  ): void;
  addCompletedReconcilableDeferredGroupedFieldSet(
    reconcilableResult: ReconcilableDeferredGroupedFieldSetResult,
  ): void;
  getNewPending(): ReadonlyArray<SubsequentResultRecord>;
  completedIncrementalData(): {
    [Symbol.asyncIterator](): any;
    next: () => Promise<IteratorResult<Iterable<IncrementalDataRecordResult>>>;
    return: () => Promise<
      IteratorResult<Iterable<IncrementalDataRecordResult>>
    >;
  };
  hasNext(): boolean;
  completeDeferredFragment(
    deferredFragmentRecord: DeferredFragmentRecord,
  ): Array<ReconcilableDeferredGroupedFieldSetResult> | undefined;
  removeDeferredFragment(
    deferredFragmentRecord: DeferredFragmentRecord,
  ): boolean;
  removeStream(streamRecord: StreamRecord): void;
  private _removePending;
  private _addDeferredGroupedFieldSetRecord;
  private _addStreamRecord;
  private _addDeferredFragmentNode;
  private _onStreamItems;
  private _yieldCurrentCompletedIncrementalData;
  private _enqueue;
}
