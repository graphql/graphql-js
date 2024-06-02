import { isPromise } from '../jsutils/isPromise.js';
import { promiseWithResolvers } from '../jsutils/promiseWithResolvers.js';

import type {
  DeferredFragmentRecord,
  DeferredGroupedFieldSetResult,
  IncrementalDataRecord,
  IncrementalDataRecordResult,
  ReconcilableDeferredGroupedFieldSetResult,
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
  private _pending: Set<SubsequentResultRecord>;
  private _newPending: Set<SubsequentResultRecord>;
  private _completedQueue: Array<IncrementalDataRecordResult>;
  private _nextQueue: Array<
    (iterable: IteratorResult<Iterable<IncrementalDataRecordResult>>) => void
  >;

  constructor() {
    this._pending = new Set();
    this._newPending = new Set();
    this._completedQueue = [];
    this._nextQueue = [];
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
          this._enqueue(resolved);
        });
      } else {
        this._enqueue(result);
      }
    }
  }

  getNewPending(): ReadonlyArray<SubsequentResultRecord> {
    const newPending = [];
    for (const node of this._newPending) {
      if (isDeferredFragmentRecord(node)) {
        if (node.expectedReconcilableResults) {
          this._pending.add(node);
          newPending.push(node);
          continue;
        }
        for (const child of node.children) {
          this._newPending.add(child);
        }
      } else {
        this._pending.add(node);
        newPending.push(node);
      }
    }
    this._newPending.clear();
    return newPending;
  }

  completedIncrementalData() {
    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      next: (): Promise<
        IteratorResult<Iterable<IncrementalDataRecordResult>>
      > => {
        const firstResult = this._completedQueue.shift();
        if (firstResult !== undefined) {
          return Promise.resolve({
            value: this._yieldCurrentCompletedIncrementalData(firstResult),
            done: false,
          });
        }
        const { promise, resolve } =
          promiseWithResolvers<
            IteratorResult<Iterable<IncrementalDataRecordResult>>
          >();
        this._nextQueue.push(resolve);
        return promise;
      },
      return: (): Promise<
        IteratorResult<Iterable<IncrementalDataRecordResult>>
      > => {
        for (const resolve of this._nextQueue) {
          resolve({ value: undefined, done: true });
        }
        return Promise.resolve({ value: undefined, done: true });
      },
    };
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
    this.removeSubsequentResultRecord(deferredFragmentRecord);
    for (const child of deferredFragmentRecord.children) {
      this._newPending.add(child);
      for (const result of child.results) {
        this._enqueue(result);
      }
    }
    return reconcilableResults;
  }

  removeSubsequentResultRecord(
    subsequentResultRecord: SubsequentResultRecord,
  ): void {
    this._pending.delete(subsequentResultRecord);
    if (this._pending.size === 0) {
      for (const resolve of this._nextQueue) {
        resolve({ value: undefined, done: true });
      }
    }
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
      this._enqueue(result);
    }
  }

  private *_yieldCurrentCompletedIncrementalData(
    first: IncrementalDataRecordResult,
  ): Generator<IncrementalDataRecordResult> {
    yield first;
    let completed;
    while ((completed = this._completedQueue.shift()) !== undefined) {
      yield completed;
    }
  }

  private _enqueue(completed: IncrementalDataRecordResult): void {
    const next = this._nextQueue.shift();
    if (next !== undefined) {
      next({
        value: this._yieldCurrentCompletedIncrementalData(completed),
        done: false,
      });
      return;
    }
    this._completedQueue.push(completed);
  }
}
