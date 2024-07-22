import { BoxedPromiseOrValue } from '../jsutils/BoxedPromiseOrValue.js';
import { invariant } from '../jsutils/invariant.js';
import { isPromise } from '../jsutils/isPromise.js';
import type { Path } from '../jsutils/Path.js';
import { pathAtFieldDepth } from '../jsutils/Path.js';
import { promiseWithResolvers } from '../jsutils/promiseWithResolvers.js';

import type { GraphQLError } from '../error/GraphQLError.js';

import type { DeferUsage } from './collectFields.js';
import type {
  DeferredGroupedFieldSetRecord,
  IncrementalDataRecord,
  IncrementalDataRecordResult,
  ReconcilableDeferredGroupedFieldSetResult,
  StreamItemRecord,
  StreamRecord,
  SubsequentResultRecord,
} from './types.js';
import {
  DeferredFragmentRecord,
  isDeferredFragmentRecord,
  isDeferredGroupedFieldSetRecord,
} from './types.js';

/**
 * @internal
 */
export class IncrementalGraph {
  private _rootNodes: Set<SubsequentResultRecord>;

  private _rootDeferredFragments = new WeakMap<
    DeferUsage,
    DeferredFragmentRecord
  >();

  private _nonRootDeferredFragments = new WeakMap<
    Path,
    WeakMap<DeferUsage, DeferredFragmentRecord>
  >();

  private _completedQueue: Array<IncrementalDataRecordResult>;
  private _nextQueue: Array<
    (iterable: Iterable<IncrementalDataRecordResult> | undefined) => void
  >;

  constructor() {
    this._rootNodes = new Set();
    this._completedQueue = [];
    this._nextQueue = [];
  }

  getNewRootNodes(
    incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
  ): ReadonlyArray<SubsequentResultRecord> {
    const initialResultChildren = new Set<SubsequentResultRecord>();
    this._addIncrementalDataRecords(
      incrementalDataRecords,
      undefined,
      initialResultChildren,
    );
    return this._promoteNonEmptyToRoot(initialResultChildren);
  }

  addCompletedReconcilableDeferredGroupedFieldSet(
    reconcilableResult: ReconcilableDeferredGroupedFieldSetResult,
  ): void {
    const { deferUsages, path } =
      reconcilableResult.deferredGroupedFieldSetRecord;
    const deferredFragmentRecords: Array<DeferredFragmentRecord> = [];
    for (const deferUsage of deferUsages) {
      const deferredFragmentRecord = this.getDeferredFragmentRecord(
        deferUsage,
        path,
      );
      deferredFragmentRecords.push(deferredFragmentRecord);
      deferredFragmentRecord.deferredGroupedFieldSetRecords.delete(
        reconcilableResult.deferredGroupedFieldSetRecord,
      );
      deferredFragmentRecord.reconcilableResults.add(reconcilableResult);
    }

    const incrementalDataRecords = reconcilableResult.incrementalDataRecords;
    if (incrementalDataRecords !== undefined) {
      this._addIncrementalDataRecords(
        incrementalDataRecords,
        deferredFragmentRecords,
      );
    }
  }

  getDeferredFragmentRecord(
    deferUsage: DeferUsage,
    path: Path | undefined,
  ): DeferredFragmentRecord {
    const deferUsagePath = pathAtFieldDepth(path, deferUsage.fieldDepth);
    let deferredFragmentRecords:
      | WeakMap<DeferUsage, DeferredFragmentRecord>
      | undefined;
    if (deferUsagePath === undefined) {
      deferredFragmentRecords = this._rootDeferredFragments;
    } else {
      deferredFragmentRecords =
        this._nonRootDeferredFragments.get(deferUsagePath);
      if (deferredFragmentRecords === undefined) {
        deferredFragmentRecords = new WeakMap();
        this._nonRootDeferredFragments.set(
          deferUsagePath,
          deferredFragmentRecords,
        );
      }
    }
    let deferredFragmentRecord = deferredFragmentRecords.get(deferUsage);
    if (deferredFragmentRecord === undefined) {
      let parent: DeferredFragmentRecord | undefined;
      const parentDeferUsage = deferUsage.parentDeferUsage;
      if (parentDeferUsage !== undefined) {
        const parentPath = pathAtFieldDepth(
          deferUsagePath,
          parentDeferUsage.fieldDepth,
        );
        parent = this.getDeferredFragmentRecord(parentDeferUsage, parentPath);
      }
      deferredFragmentRecord = new DeferredFragmentRecord(
        deferUsagePath,
        deferUsage.label,
        parent,
      );
      deferredFragmentRecords.set(deferUsage, deferredFragmentRecord);
    }
    return deferredFragmentRecord;
  }

  *currentCompletedBatch(): Generator<IncrementalDataRecordResult> {
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

  nextCompletedBatch(): Promise<
    Iterable<IncrementalDataRecordResult> | undefined
  > {
    const { promise, resolve } = promiseWithResolvers<
      Iterable<IncrementalDataRecordResult> | undefined
    >();
    this._nextQueue.push(resolve);
    return promise;
  }

  abort(): void {
    for (const resolve of this._nextQueue) {
      resolve(undefined);
    }
  }

  hasNext(): boolean {
    return this._rootNodes.size > 0;
  }

  completeDeferredFragment(deferredFragmentRecord: DeferredFragmentRecord):
    | {
        newRootNodes: ReadonlyArray<SubsequentResultRecord>;
        reconcilableResults: ReadonlyArray<ReconcilableDeferredGroupedFieldSetResult>;
      }
    | undefined {
    if (
      !this._rootNodes.has(deferredFragmentRecord) ||
      deferredFragmentRecord.deferredGroupedFieldSetRecords.size > 0
    ) {
      return;
    }
    const reconcilableResults = Array.from(
      deferredFragmentRecord.reconcilableResults,
    );
    this._removeRootNode(deferredFragmentRecord);
    for (const reconcilableResult of reconcilableResults) {
      const { deferUsages, path } =
        reconcilableResult.deferredGroupedFieldSetRecord;
      for (const otherDeferUsage of deferUsages) {
        const otherDeferredFragmentRecord = this.getDeferredFragmentRecord(
          otherDeferUsage,
          path,
        );
        otherDeferredFragmentRecord.reconcilableResults.delete(
          reconcilableResult,
        );
      }
    }
    const newRootNodes = this._promoteNonEmptyToRoot(
      deferredFragmentRecord.children,
    );
    return { newRootNodes, reconcilableResults };
  }

  removeDeferredFragment(
    deferredFragmentRecord: DeferredFragmentRecord,
  ): boolean {
    if (!this._rootNodes.has(deferredFragmentRecord)) {
      return false;
    }
    this._removeRootNode(deferredFragmentRecord);
    return true;
  }

  removeStream(streamRecord: StreamRecord): void {
    this._removeRootNode(streamRecord);
  }

  private _removeRootNode(
    subsequentResultRecord: SubsequentResultRecord,
  ): void {
    this._rootNodes.delete(subsequentResultRecord);
  }

  private _addIncrementalDataRecords(
    incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
    parents: ReadonlyArray<DeferredFragmentRecord> | undefined,
    initialResultChildren?: Set<SubsequentResultRecord> | undefined,
  ): void {
    for (const incrementalDataRecord of incrementalDataRecords) {
      if (isDeferredGroupedFieldSetRecord(incrementalDataRecord)) {
        const { deferUsages, path } = incrementalDataRecord;
        for (const deferUsage of deferUsages) {
          const deferredFragmentRecord = this.getDeferredFragmentRecord(
            deferUsage,
            path,
          );
          this._addDeferredFragment(
            deferredFragmentRecord,
            initialResultChildren,
          );
          deferredFragmentRecord.deferredGroupedFieldSetRecords.add(
            incrementalDataRecord,
          );
        }
        if (this._completesRootNode(incrementalDataRecord)) {
          this._onDeferredGroupedFieldSet(incrementalDataRecord);
        }
      } else if (parents === undefined) {
        invariant(initialResultChildren !== undefined);
        initialResultChildren.add(incrementalDataRecord);
      } else {
        for (const parent of parents) {
          this._addDeferredFragment(parent, initialResultChildren);
          parent.children.add(incrementalDataRecord);
        }
      }
    }
  }

  private _promoteNonEmptyToRoot(
    maybeEmptyNewRootNodes: Set<SubsequentResultRecord>,
  ): ReadonlyArray<SubsequentResultRecord> {
    const newRootNodes: Array<SubsequentResultRecord> = [];
    for (const node of maybeEmptyNewRootNodes) {
      if (isDeferredFragmentRecord(node)) {
        if (node.deferredGroupedFieldSetRecords.size > 0) {
          for (const deferredGroupedFieldSetRecord of node.deferredGroupedFieldSetRecords) {
            if (!this._completesRootNode(deferredGroupedFieldSetRecord)) {
              this._onDeferredGroupedFieldSet(deferredGroupedFieldSetRecord);
            }
          }
          this._rootNodes.add(node);
          newRootNodes.push(node);
          continue;
        }
        for (const child of node.children) {
          maybeEmptyNewRootNodes.add(child);
        }
      } else {
        this._rootNodes.add(node);
        newRootNodes.push(node);

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this._onStreamItems(node);
      }
    }
    return newRootNodes;
  }

  private _completesRootNode(
    deferredGroupedFieldSetRecord: DeferredGroupedFieldSetRecord,
  ): boolean {
    const { deferUsages, path } = deferredGroupedFieldSetRecord;
    return Array.from(deferUsages).some((deferUsage) =>
      this._rootNodes.has(this.getDeferredFragmentRecord(deferUsage, path)),
    );
  }

  private _addDeferredFragment(
    deferredFragmentRecord: DeferredFragmentRecord,
    initialResultChildren: Set<SubsequentResultRecord> | undefined,
  ): void {
    if (this._rootNodes.has(deferredFragmentRecord)) {
      return;
    }
    const parent = deferredFragmentRecord.parent;
    if (parent === undefined) {
      invariant(initialResultChildren !== undefined);
      initialResultChildren.add(deferredFragmentRecord);
      return;
    }
    parent.children.add(deferredFragmentRecord);
    this._addDeferredFragment(parent, initialResultChildren);
  }

  private _onDeferredGroupedFieldSet(
    deferredGroupedFieldSetRecord: DeferredGroupedFieldSetRecord,
  ): void {
    let deferredGroupedFieldSetResult = deferredGroupedFieldSetRecord.result;
    if (!(deferredGroupedFieldSetResult instanceof BoxedPromiseOrValue)) {
      deferredGroupedFieldSetResult = deferredGroupedFieldSetResult();
    }
    const value = deferredGroupedFieldSetResult.value;
    if (isPromise(value)) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      value.then((resolved) => this._enqueue(resolved));
    } else {
      this._enqueue(value);
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
    yield* this.currentCompletedBatch();
  }

  private _enqueue(completed: IncrementalDataRecordResult): void {
    const next = this._nextQueue.shift();
    if (next !== undefined) {
      next(this._yieldCurrentCompletedIncrementalData(completed));
      return;
    }
    this._completedQueue.push(completed);
  }
}
