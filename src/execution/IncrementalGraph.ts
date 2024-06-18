import { BoxedPromiseOrValue } from '../jsutils/BoxedPromiseOrValue.js';
import { invariant } from '../jsutils/invariant.js';
import { isPromise } from '../jsutils/isPromise.js';
import { promiseWithResolvers } from '../jsutils/promiseWithResolvers.js';

import type { GraphQLError } from '../error/GraphQLError.js';

import type {
  DeferredFragmentRecord,
  DeferredGroupedFieldSetRecord,
  DeferredGroupedFieldSetResult,
  IncrementalDataRecord,
  IncrementalDataRecordResult,
  NonReconcilableDeferredGroupedFieldSetResult,
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
  children: Set<SubsequentResultNode>;
}

function isDeferredFragmentNode(
  node: SubsequentResultNode | undefined,
): node is DeferredFragmentNode {
  return node !== undefined && 'deferredFragmentRecord' in node;
}

type SubsequentResultNode = DeferredFragmentNode | StreamRecord;

/**
 * @internal
 */
export class IncrementalGraph {
  private _pendingIncrementalData: Set<IncrementalDataRecord>;
  private _deferredFragmentNodes: Map<
    DeferredFragmentRecord,
    DeferredFragmentNode
  >;

  private _completedQueue: Array<IncrementalDataRecordResult>;
  private _nextQueue: Array<
    (iterable: IteratorResult<Iterable<IncrementalDataRecordResult>>) => void
  >;

  constructor() {
    this._pendingIncrementalData = new Set();
    this._deferredFragmentNodes = new Map();
    this._completedQueue = [];
    this._nextQueue = [];
  }

  getNewPending(
    incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
  ): ReadonlyArray<SubsequentResultRecord> {
    const newPending = new Set<SubsequentResultNode>();
    this._addIncrementalDataRecords(
      incrementalDataRecords,
      undefined,
      newPending,
    );
    return this._pendingNodesToResults(newPending);
  }

  addCompletedReconcilableDeferredGroupedFieldSet(
    reconcilableResult: ReconcilableDeferredGroupedFieldSetResult,
  ): void {
    for (const deferredFragmentNode of this._fragmentsToNodes(
      reconcilableResult.deferredGroupedFieldSetRecord.deferredFragmentRecords,
    )) {
      deferredFragmentNode.deferredGroupedFieldSetRecords.delete(
        reconcilableResult.deferredGroupedFieldSetRecord,
      );
      deferredFragmentNode.reconcilableResults.add(reconcilableResult);
    }

    const incrementalDataRecords = reconcilableResult.incrementalDataRecords;
    if (incrementalDataRecords !== undefined) {
      this._addIncrementalDataRecords(
        incrementalDataRecords,
        reconcilableResult.deferredGroupedFieldSetRecord
          .deferredFragmentRecords,
      );
    }
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
    return this._pendingIncrementalData.size > 0;
  }

  completeDeferredFragment(deferredFragmentRecord: DeferredFragmentRecord):
    | {
        newPending: ReadonlyArray<SubsequentResultRecord>;
        reconcilableResults: ReadonlyArray<ReconcilableDeferredGroupedFieldSetResult>;
      }
    | undefined {
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
      const deferredGroupedFieldSetRecord =
        reconcilableResult.deferredGroupedFieldSetRecord;
      this._removePendingIncrementalData(deferredGroupedFieldSetRecord);
      for (const otherDeferredFragmentNode of this._fragmentsToNodes(
        deferredGroupedFieldSetRecord.deferredFragmentRecords,
      )) {
        otherDeferredFragmentNode.reconcilableResults.delete(
          reconcilableResult,
        );
      }
    }
    this._deferredFragmentNodes.delete(
      deferredFragmentNode.deferredFragmentRecord,
    );
    const newPending = this._pendingNodesToResults(
      deferredFragmentNode.children,
    );
    return { newPending, reconcilableResults };
  }

  removeNonReconcilableDeferredGroupedFieldSet(
    nonReconcilableResult: NonReconcilableDeferredGroupedFieldSetResult,
  ): ReadonlyArray<DeferredFragmentRecord> {
    const deferredFragmentRecords: Array<DeferredFragmentRecord> = [];
    const deferredGroupedFieldSetRecord =
      nonReconcilableResult.deferredGroupedFieldSetRecord;
    this._removePendingIncrementalData(deferredGroupedFieldSetRecord);
    for (const deferredFragmentRecord of deferredGroupedFieldSetRecord.deferredFragmentRecords) {
      if (this._removeDeferredFragment(deferredFragmentRecord)) {
        deferredFragmentRecords.push(deferredFragmentRecord);
      }
    }
    return deferredFragmentRecords;
  }

  removeStream(streamRecord: StreamRecord): void {
    this._removePendingIncrementalData(streamRecord);
  }

  private _removeDeferredFragment(
    deferredFragmentRecord: DeferredFragmentRecord,
  ): boolean {
    const deferredFragmentNode = this._deferredFragmentNodes.get(
      deferredFragmentRecord,
    );
    if (deferredFragmentNode === undefined) {
      return false;
    }
    this._deferredFragmentNodes.delete(
      deferredFragmentNode.deferredFragmentRecord,
    );
    const deferredGroupedFieldSetRecords = [
      ...deferredFragmentNode.deferredGroupedFieldSetRecords,
      ...Array.from(deferredFragmentNode.reconcilableResults).map(
        (result) => result.deferredGroupedFieldSetRecord,
      ),
    ];
    for (const deferredGroupedFieldSetRecord of deferredGroupedFieldSetRecords) {
      if (
        !deferredGroupedFieldSetRecord.deferredFragmentRecords.some(
          (otherDeferredFragmentRecord) =>
            this._deferredFragmentNodes.has(otherDeferredFragmentRecord),
        )
      ) {
        this._pendingIncrementalData.delete(deferredGroupedFieldSetRecord);
      }
    }
    // TODO: add test case for an erroring deferred fragment with child defers
    /* c8 ignore next 5 */
    for (const child of deferredFragmentNode.children) {
      if (isDeferredFragmentNode(child)) {
        this._removeDeferredFragment(child.deferredFragmentRecord);
      }
    }
    return true;
  }

  private _removePendingIncrementalData(
    incrementalDataRecord: IncrementalDataRecord,
  ): void {
    this._pendingIncrementalData.delete(incrementalDataRecord);
    if (this._pendingIncrementalData.size === 0) {
      for (const resolve of this._nextQueue) {
        resolve({ value: undefined, done: true });
      }
    }
  }

  private _addIncrementalDataRecords(
    incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
    parents: ReadonlyArray<DeferredFragmentRecord> | undefined,
    newPending?: Set<SubsequentResultNode> | undefined,
  ): void {
    for (const incrementalDataRecord of incrementalDataRecords) {
      if (isDeferredGroupedFieldSetRecord(incrementalDataRecord)) {
        for (const deferredFragmentRecord of incrementalDataRecord.deferredFragmentRecords) {
          const deferredFragmentNode = this._addDeferredFragmentNode(
            deferredFragmentRecord,
            newPending,
          );
          deferredFragmentNode.deferredGroupedFieldSetRecords.add(
            incrementalDataRecord,
          );
        }
        if (
          incrementalDataRecord.deferredFragmentRecords.some(
            (deferredFragmentRecord) => deferredFragmentRecord.pending,
          )
        ) {
          this._onDeferredGroupedFieldSet(incrementalDataRecord);
        }
      } else if (parents === undefined) {
        this._pendingIncrementalData.add(incrementalDataRecord);
        invariant(newPending !== undefined);
        newPending.add(incrementalDataRecord);
      } else {
        this._pendingIncrementalData.add(incrementalDataRecord);
        for (const parent of parents) {
          const deferredFragmentNode = this._addDeferredFragmentNode(
            parent,
            newPending,
          );
          deferredFragmentNode.children.add(incrementalDataRecord);
        }
      }
    }
  }

  private _pendingNodesToResults(
    newPendingNodes: Set<SubsequentResultNode>,
  ): ReadonlyArray<SubsequentResultRecord> {
    const newPendingResults: Array<SubsequentResultRecord> = [];
    for (const node of newPendingNodes) {
      if (isDeferredFragmentNode(node)) {
        if (node.deferredGroupedFieldSetRecords.size > 0) {
          node.deferredFragmentRecord.setAsPending();
          for (const deferredGroupedFieldSetRecord of node.deferredGroupedFieldSetRecords) {
            if (
              !this._pendingIncrementalData.has(deferredGroupedFieldSetRecord)
            ) {
              this._onDeferredGroupedFieldSet(deferredGroupedFieldSetRecord);
            }
          }
          newPendingResults.push(node.deferredFragmentRecord);
          continue;
        }
        this._deferredFragmentNodes.delete(node.deferredFragmentRecord);
        for (const child of node.children) {
          newPendingNodes.add(child);
        }
      } else {
        newPendingResults.push(node);

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this._onStreamItems(node);
      }
    }
    return newPendingResults;
  }

  private _fragmentsToNodes(
    deferredFragmentRecords: ReadonlyArray<DeferredFragmentRecord>,
  ): Array<DeferredFragmentNode> {
    return deferredFragmentRecords
      .map((deferredFragmentRecord) =>
        this._deferredFragmentNodes.get(deferredFragmentRecord),
      )
      .filter<DeferredFragmentNode>(isDeferredFragmentNode);
  }

  private _addDeferredFragmentNode(
    deferredFragmentRecord: DeferredFragmentRecord,
    newPending: Set<SubsequentResultNode> | undefined,
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
      children: new Set(),
    };
    this._deferredFragmentNodes.set(
      deferredFragmentRecord,
      deferredFragmentNode,
    );
    const parent = deferredFragmentRecord.parent;
    if (parent === undefined) {
      invariant(newPending !== undefined);
      newPending.add(deferredFragmentNode);
      return deferredFragmentNode;
    }
    const parentNode = this._addDeferredFragmentNode(parent, newPending);
    parentNode.children.add(deferredFragmentNode);
    return deferredFragmentNode;
  }

  private _onDeferredGroupedFieldSet(
    deferredGroupedFieldSetRecord: DeferredGroupedFieldSetRecord,
  ): void {
    this._pendingIncrementalData.add(deferredGroupedFieldSetRecord);
    const result = (
      deferredGroupedFieldSetRecord.result as BoxedPromiseOrValue<DeferredGroupedFieldSetResult>
    ).value;
    if (isPromise(result)) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      result.then((resolved) => this._enqueue(resolved));
    } else {
      this._enqueue(result);
    }
  }

  private async _onStreamItems(streamRecord: StreamRecord): Promise<void> {
    let items: Array<unknown> = [];
    let errors: Array<GraphQLError> = [];
    let incrementalDataRecords: Array<IncrementalDataRecord> = [];
    const streamItemQueue = streamRecord.streamItemQueue;
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
