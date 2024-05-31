import { isPromise } from '../jsutils/isPromise.js';
import { promiseWithResolvers } from '../jsutils/promiseWithResolvers.js';

import type {
  DeferredFragmentRecord,
  DeferredGroupedFieldSetResult,
  IncrementalDataRecord,
  IncrementalDataRecordResult,
  ReconcilableDeferredGroupedFieldSetResult,
  StreamItemsResult,
  SubsequentResultRecord,
} from './types.js';
import {
  isDeferredFragmentRecord,
  isDeferredGroupedFieldSetRecord,
} from './types.js';

/**
 * @internal
 */
export class IncrementalGraph {
  // these are assigned within the Promise executor called synchronously within the constructor
  newCompletedResultAvailable!: Promise<unknown>;
  private _resolve!: () => void;

  private _pending: Set<SubsequentResultRecord>;
  private _newPending: Set<SubsequentResultRecord>;
  private _completedResultQueue: Array<IncrementalDataRecordResult>;

  constructor() {
    this._pending = new Set();
    this._newPending = new Set();
    this._completedResultQueue = [];
    this._reset();
  }

  addIncrementalDataRecords(
    incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
  ): void {
    for (const incrementalDataRecord of incrementalDataRecords) {
      if (isDeferredGroupedFieldSetRecord(incrementalDataRecord)) {
        for (const deferredFragmentRecord of incrementalDataRecord.deferredFragmentRecords) {
          deferredFragmentRecord.expectedReconcilableResults++;

          this._addDeferredFragmentRecord(deferredFragmentRecord);
        }

        const result = incrementalDataRecord.result;
        if (isPromise(result)) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          result.then((resolved) => {
            this._enqueueCompletedDeferredGroupedFieldSet(resolved);
          });
        } else {
          this._enqueueCompletedDeferredGroupedFieldSet(result);
        }

        continue;
      }

      const streamRecord = incrementalDataRecord.streamRecord;
      if (streamRecord.id === undefined) {
        this._newPending.add(streamRecord);
      }

      const result = incrementalDataRecord.result;
      if (isPromise(result)) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        result.then((resolved) => {
          this._enqueueCompletedStreamItems(resolved);
        });
      } else {
        this._enqueueCompletedStreamItems(result);
      }
    }
  }

  getNewPending(): ReadonlyArray<SubsequentResultRecord> {
    const maybeEmptyNewPending = this._newPending;
    const newPending = [];
    for (const node of maybeEmptyNewPending) {
      if (isDeferredFragmentRecord(node)) {
        if (node.expectedReconcilableResults) {
          this._pending.add(node);
          newPending.push(node);
          continue;
        }
        for (const child of node.children) {
          this._addNonEmptyNewPending(child, newPending);
        }
      } else {
        this._pending.add(node);
        newPending.push(node);
      }
    }
    this._newPending.clear();
    return newPending;
  }

  *completedResults(): Generator<IncrementalDataRecordResult> {
    let completedResult: IncrementalDataRecordResult | undefined;
    while (
      (completedResult = this._completedResultQueue.shift()) !== undefined
    ) {
      yield completedResult;
    }
  }

  hasNext(): boolean {
    return this._pending.size > 0;
  }

  completeDeferredFragment(
    deferredFragmentRecord: DeferredFragmentRecord,
  ): Array<ReconcilableDeferredGroupedFieldSetResult> | undefined {
    const reconcilableResults = deferredFragmentRecord.reconcilableResults;
    if (
      deferredFragmentRecord.expectedReconcilableResults !==
      reconcilableResults.length
    ) {
      return;
    }
    this._pending.delete(deferredFragmentRecord);
    for (const child of deferredFragmentRecord.children) {
      this._newPending.add(child);
      this._completedResultQueue.push(...child.results);
    }
    return reconcilableResults;
  }

  removeSubsequentResultRecord(
    subsequentResultRecord: SubsequentResultRecord,
  ): void {
    this._pending.delete(subsequentResultRecord);
  }

  private _addDeferredFragmentRecord(
    deferredFragmentRecord: DeferredFragmentRecord,
  ): void {
    const parent = deferredFragmentRecord.parent;
    if (parent === undefined) {
      // Below is equivalent and slightly faster version of:
      //   if (this._pending.has(deferredFragmentRecord)) { ... }
      // as all released deferredFragmentRecords have ids.
      if (deferredFragmentRecord.id !== undefined) {
        return;
      }

      this._newPending.add(deferredFragmentRecord);
      return;
    }

    if (parent.children.has(deferredFragmentRecord)) {
      return;
    }

    parent.children.add(deferredFragmentRecord);

    this._addDeferredFragmentRecord(parent);
  }

  private _addNonEmptyNewPending(
    deferredFragmentRecord: DeferredFragmentRecord,
    newPending: Array<SubsequentResultRecord>,
  ): void {
    if (deferredFragmentRecord.expectedReconcilableResults) {
      this._pending.add(deferredFragmentRecord);
      newPending.push(deferredFragmentRecord);
      return;
    }
    /* c8 ignore next 5 */
    // TODO: add test case for this, if when skipping an empty deferred fragment, the empty fragment has nested children.
    for (const child of deferredFragmentRecord.children) {
      this._addNonEmptyNewPending(child, newPending);
    }
  }

  private _enqueueCompletedDeferredGroupedFieldSet(
    result: DeferredGroupedFieldSetResult,
  ): void {
    let hasPendingParent = false;
    for (const deferredFragmentRecord of result.deferredFragmentRecords) {
      if (deferredFragmentRecord.id !== undefined) {
        hasPendingParent = true;
      }
      deferredFragmentRecord.results.push(result);
    }
    if (hasPendingParent) {
      this._completedResultQueue.push(result);
      this._trigger();
    }
  }

  private _enqueueCompletedStreamItems(result: StreamItemsResult): void {
    this._completedResultQueue.push(result);
    this._trigger();
  }

  private _trigger() {
    this._resolve();
    this._reset();
  }

  private _reset() {
    const { promise: newCompletedResultAvailable, resolve } =
      // promiseWithResolvers uses void only as a generic type parameter
      // see: https://typescript-eslint.io/rules/no-invalid-void-type/
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      promiseWithResolvers<void>();
    this._resolve = resolve;
    this.newCompletedResultAvailable = newCompletedResultAvailable;
  }
}
