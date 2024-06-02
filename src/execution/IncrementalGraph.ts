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
import { isDeferredGroupedFieldSetRecord } from './types.js';

interface DeferredFragmentNode {
  deferredFragmentRecord: DeferredFragmentRecord;
  expectedReconcilableResults: number;
  results: Array<DeferredGroupedFieldSetResult>;
  reconcilableResults: Array<ReconcilableDeferredGroupedFieldSetResult>;
  children: Array<DeferredFragmentNode>;
}

function isDeferredFragmentNode(
  node: DeferredFragmentNode | undefined,
): node is DeferredFragmentNode {
  return node !== undefined;
}

function isStreamNode(
  subsequentResultNode: SubsequentResultNode,
): subsequentResultNode is SubsequentResultRecord {
  return 'path' in subsequentResultNode;
}

type SubsequentResultNode = DeferredFragmentNode | SubsequentResultRecord;

/**
 * @internal
 */
export class IncrementalGraph {
  private _pending: Set<SubsequentResultNode>;
  private _deferredFragmentNodes: Map<
    DeferredFragmentRecord,
    DeferredFragmentNode
  >;

  private _newPending: Set<SubsequentResultNode>;
  private _completedQueue: Array<IncrementalDataRecordResult>;
  private _nextQueue: Array<
    (iterable: IteratorResult<Iterable<IncrementalDataRecordResult>>) => void
  >;

  constructor() {
    this._pending = new Set();
    this._deferredFragmentNodes = new Map();
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
          const deferredFragmentNode = this._addDeferredFragmentNode(
            deferredFragmentRecord,
          );
          deferredFragmentNode.expectedReconcilableResults++;
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

  addCompletedReconcilableDeferredGroupedFieldSet(
    reconcilableResult: ReconcilableDeferredGroupedFieldSetResult,
  ): void {
    const deferredFragmentNodes: Array<DeferredFragmentNode> =
      reconcilableResult.deferredFragmentRecords
        .map((deferredFragmentRecord) =>
          this._deferredFragmentNodes.get(deferredFragmentRecord),
        )
        .filter<DeferredFragmentNode>(isDeferredFragmentNode);
    for (const deferredFragmentNode of deferredFragmentNodes) {
      deferredFragmentNode.reconcilableResults.push(reconcilableResult);
    }
  }

  getNewPending(): ReadonlyArray<SubsequentResultRecord> {
    const newPending: Array<SubsequentResultRecord> = [];
    for (const node of this._newPending) {
      if (isStreamNode(node)) {
        this._pending.add(node);
        newPending.push(node);
      } else if (node.expectedReconcilableResults) {
        this._pending.add(node);
        newPending.push(node.deferredFragmentRecord);
      } else {
        for (const child of node.children) {
          this._newPending.add(child);
        }
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
    const deferredFragmentNode = this._deferredFragmentNodes.get(
      deferredFragmentRecord,
    );
    // TODO: add test case?
    /* c8 ignore next 3 */
    if (deferredFragmentNode === undefined) {
      return undefined;
    }
    const reconcilableResults = deferredFragmentNode.reconcilableResults;
    if (
      deferredFragmentNode.expectedReconcilableResults !==
      reconcilableResults.length
    ) {
      return;
    }
    this._removePending(deferredFragmentNode);
    for (const child of deferredFragmentNode.children) {
      this._newPending.add(child);
      for (const result of child.results) {
        this._enqueue(result);
      }
    }
    return reconcilableResults;
  }

  removeDeferredFragment(deferredFragmentRecord: DeferredFragmentRecord): void {
    const deferredFragmentNode = this._deferredFragmentNodes.get(
      deferredFragmentRecord,
    );
    // TODO: add test case?
    /* c8 ignore next 3 */
    if (deferredFragmentNode === undefined) {
      return;
    }
    this._removePending(deferredFragmentNode);
    this._deferredFragmentNodes.delete(deferredFragmentRecord);
    // TODO: add test case for an erroring deferred fragment with child defers
    /* c8 ignore next 3 */
    for (const child of deferredFragmentNode.children) {
      this.removeDeferredFragment(child.deferredFragmentRecord);
    }
  }

  removeStream(streamRecord: SubsequentResultRecord): void {
    this._removePending(streamRecord);
  }

  private _removePending(subsequentResultNode: SubsequentResultNode): void {
    this._pending.delete(subsequentResultNode);
    if (this._pending.size === 0) {
      for (const resolve of this._nextQueue) {
        resolve({ value: undefined, done: true });
      }
    }
  }

  private _addDeferredFragmentNode(
    deferredFragmentRecord: DeferredFragmentRecord,
  ): DeferredFragmentNode {
    let deferredFragmentNode = this._deferredFragmentNodes.get(
      deferredFragmentRecord,
    );
    if (deferredFragmentNode !== undefined) {
      return deferredFragmentNode;
    }
    deferredFragmentNode = {
      deferredFragmentRecord,
      expectedReconcilableResults: 0,
      results: [],
      reconcilableResults: [],
      children: [],
    };
    this._deferredFragmentNodes.set(
      deferredFragmentRecord,
      deferredFragmentNode,
    );
    const parent = deferredFragmentRecord.parent;
    if (parent === undefined) {
      this._newPending.add(deferredFragmentNode);
      return deferredFragmentNode;
    }
    const parentNode = this._addDeferredFragmentNode(parent);
    parentNode.children.push(deferredFragmentNode);
    return deferredFragmentNode;
  }

  private _enqueueCompletedDeferredGroupedFieldSet(
    result: DeferredGroupedFieldSetResult,
  ): void {
    let isPending = false;
    for (const deferredFragmentRecord of result.deferredFragmentRecords) {
      const deferredFragmentNode = this._deferredFragmentNodes.get(
        deferredFragmentRecord,
      );
      // TODO: add test case?
      /* c8 ignore next 3 */
      if (deferredFragmentNode === undefined) {
        continue;
      }
      if (this._pending.has(deferredFragmentNode)) {
        isPending = true;
      }
      deferredFragmentNode.results.push(result);
    }
    if (isPending) {
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
