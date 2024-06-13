import { BoxedPromiseOrValue } from '../jsutils/BoxedPromiseOrValue.js';
import { isPromise } from '../jsutils/isPromise.js';
import { promiseWithResolvers } from '../jsutils/promiseWithResolvers.js';

import type { GraphQLError } from '../error/GraphQLError.js';

import type {
  DeferredFragmentRecord,
  DeferredGroupedFieldSetRecord,
  IncrementalDataRecord,
  IncrementalDataRecordResult,
  ReconcilableDeferredGroupedFieldSetResult,
  StreamItemRecord,
  StreamRecord,
  SubsequentResultRecord,
} from './types.js';
import { isDeferredGroupedFieldSetRecord } from './types.js';

interface DeferredFragmentNode {
  deferredFragmentRecord: DeferredFragmentRecord;
  deferredGroupedFieldSetRecords: Set<DeferredGroupedFieldSetRecord>;
  reconcilableResults: Set<ReconcilableDeferredGroupedFieldSetResult>;
  children: Array<DeferredFragmentNode>;
}

function isDeferredFragmentNode(
  node: DeferredFragmentNode | undefined,
): node is DeferredFragmentNode {
  return node !== undefined;
}

function isStreamNode(
  record: SubsequentResultNode | IncrementalDataRecord,
): record is StreamRecord {
  return 'streamItemQueue' in record;
}

type SubsequentResultNode = DeferredFragmentNode | StreamRecord;

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
  private _newIncrementalDataRecords: Set<IncrementalDataRecord>;
  private _completedQueue: Array<IncrementalDataRecordResult>;
  private _nextQueue: Array<
    (iterable: IteratorResult<Iterable<IncrementalDataRecordResult>>) => void
  >;

  constructor() {
    this._pending = new Set();
    this._deferredFragmentNodes = new Map();
    this._newIncrementalDataRecords = new Set();
    this._newPending = new Set();
    this._completedQueue = [];
    this._nextQueue = [];
  }

  addIncrementalDataRecords(
    incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
  ): void {
    for (const incrementalDataRecord of incrementalDataRecords) {
      if (isDeferredGroupedFieldSetRecord(incrementalDataRecord)) {
        this._addDeferredGroupedFieldSetRecord(incrementalDataRecord);
      } else {
        this._addStreamRecord(incrementalDataRecord);
      }
    }
  }

  addCompletedReconcilableDeferredGroupedFieldSet(
    reconcilableResult: ReconcilableDeferredGroupedFieldSetResult,
  ): void {
    const deferredFragmentNodes: Array<DeferredFragmentNode> =
      reconcilableResult.deferredGroupedFieldSetRecord.deferredFragmentRecords
        .map((deferredFragmentRecord) =>
          this._deferredFragmentNodes.get(deferredFragmentRecord),
        )
        .filter<DeferredFragmentNode>(isDeferredFragmentNode);
    for (const deferredFragmentNode of deferredFragmentNodes) {
      deferredFragmentNode.deferredGroupedFieldSetRecords.delete(
        reconcilableResult.deferredGroupedFieldSetRecord,
      );
      deferredFragmentNode.reconcilableResults.add(reconcilableResult);
    }
  }

  getNewPending(): ReadonlyArray<SubsequentResultRecord> {
    const newPending: Array<SubsequentResultRecord> = [];
    for (const node of this._newPending) {
      if (isStreamNode(node)) {
        this._pending.add(node);
        newPending.push(node);
        this._newIncrementalDataRecords.add(node);
      } else if (node.deferredGroupedFieldSetRecords.size > 0) {
        for (const deferredGroupedFieldSetNode of node.deferredGroupedFieldSetRecords) {
          this._newIncrementalDataRecords.add(deferredGroupedFieldSetNode);
        }
        this._pending.add(node);
        newPending.push(node.deferredFragmentRecord);
      } else {
        for (const child of node.children) {
          this._newPending.add(child);
        }
      }
    }
    this._newPending.clear();

    for (const incrementalDataRecord of this._newIncrementalDataRecords) {
      if (isStreamNode(incrementalDataRecord)) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this._onStreamItems(
          incrementalDataRecord,
          incrementalDataRecord.streamItemQueue,
        );
      } else {
        const deferredGroupedFieldSetResult = incrementalDataRecord.result;
        const result =
          deferredGroupedFieldSetResult instanceof BoxedPromiseOrValue
            ? deferredGroupedFieldSetResult.value
            : deferredGroupedFieldSetResult().value;

        if (isPromise(result)) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          result.then((resolved) => this._enqueue(resolved));
        } else {
          this._enqueue(result);
        }
      }
    }
    this._newIncrementalDataRecords.clear();

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
    if (deferredFragmentNode.deferredGroupedFieldSetRecords.size > 0) {
      return;
    }
    const reconcilableResults = Array.from(
      deferredFragmentNode.reconcilableResults,
    );
    for (const reconcilableResult of reconcilableResults) {
      for (const otherDeferredFragmentRecord of reconcilableResult
        .deferredGroupedFieldSetRecord.deferredFragmentRecords) {
        const otherDeferredFragmentNode = this._deferredFragmentNodes.get(
          otherDeferredFragmentRecord,
        );
        if (otherDeferredFragmentNode === undefined) {
          continue;
        }
        otherDeferredFragmentNode.reconcilableResults.delete(
          reconcilableResult,
        );
      }
    }
    this._removePending(deferredFragmentNode);
    for (const child of deferredFragmentNode.children) {
      this._newPending.add(child);
    }
    return reconcilableResults;
  }

  removeDeferredFragment(
    deferredFragmentRecord: DeferredFragmentRecord,
  ): boolean {
    const deferredFragmentNode = this._deferredFragmentNodes.get(
      deferredFragmentRecord,
    );
    if (deferredFragmentNode === undefined) {
      return false;
    }
    this._removePending(deferredFragmentNode);
    this._deferredFragmentNodes.delete(deferredFragmentRecord);
    // TODO: add test case for an erroring deferred fragment with child defers
    /* c8 ignore next 3 */
    for (const child of deferredFragmentNode.children) {
      this.removeDeferredFragment(child.deferredFragmentRecord);
    }
    return true;
  }

  removeStream(streamRecord: StreamRecord): void {
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

  private _addDeferredGroupedFieldSetRecord(
    deferredGroupedFieldSetRecord: DeferredGroupedFieldSetRecord,
  ): void {
    for (const deferredFragmentRecord of deferredGroupedFieldSetRecord.deferredFragmentRecords) {
      const deferredFragmentNode = this._addDeferredFragmentNode(
        deferredFragmentRecord,
      );
      if (this._pending.has(deferredFragmentNode)) {
        this._newIncrementalDataRecords.add(deferredGroupedFieldSetRecord);
      }
      deferredFragmentNode.deferredGroupedFieldSetRecords.add(
        deferredGroupedFieldSetRecord,
      );
    }
  }

  private _addStreamRecord(streamRecord: StreamRecord): void {
    this._newPending.add(streamRecord);
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
      deferredGroupedFieldSetRecords: new Set(),
      reconcilableResults: new Set(),
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

  private async _onStreamItems(
    streamRecord: StreamRecord,
    streamItemQueue: Array<StreamItemRecord>,
  ): Promise<void> {
    let items: Array<unknown> = [];
    let errors: Array<GraphQLError> = [];
    let incrementalDataRecords: Array<IncrementalDataRecord> = [];
    let streamItemRecord: StreamItemRecord | undefined;
    while ((streamItemRecord = streamItemQueue.shift()) !== undefined) {
      let result =
        streamItemRecord instanceof BoxedPromiseOrValue
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
        this._enqueue(
          result.errors === undefined
            ? { streamRecord }
            : {
                streamRecord,
                errors: result.errors,
              },
        );
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
