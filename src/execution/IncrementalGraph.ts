import { BoxedPromiseOrValue } from '../jsutils/BoxedPromiseOrValue.js';
import { invariant } from '../jsutils/invariant.js';
import { isPromise } from '../jsutils/isPromise.js';
import { promiseWithResolvers } from '../jsutils/promiseWithResolvers.js';

import type { GraphQLError } from '../error/GraphQLError.js';

import type {
  DeferredFragmentRecord,
  DeliveryGroup,
  IncrementalDataRecord,
  IncrementalDataRecordResult,
  PendingExecutionGroup,
  StreamItemRecord,
  StreamRecord,
  SuccessfulExecutionGroup,
} from './types.js';
import { isDeferredFragmentRecord, isPendingExecutionGroup } from './types.js';

/**
 * @internal
 */
export class IncrementalGraph {
  private _rootNodes: Set<DeliveryGroup>;

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
  ): ReadonlyArray<DeliveryGroup> {
    const initialResultChildren = new Set<DeliveryGroup>();
    this._addIncrementalDataRecords(
      incrementalDataRecords,
      undefined,
      initialResultChildren,
    );
    return this._promoteNonEmptyToRoot(initialResultChildren);
  }

  addCompletedSuccessfulExecutionGroup(
    successfulExecutionGroup: SuccessfulExecutionGroup,
  ): void {
    const { pendingExecutionGroup, incrementalDataRecords } =
      successfulExecutionGroup;

    const deferredFragmentRecords =
      pendingExecutionGroup.deferredFragmentRecords;

    for (const deferredFragmentRecord of deferredFragmentRecords) {
      const { pendingExecutionGroups, successfulExecutionGroups } =
        deferredFragmentRecord;
      pendingExecutionGroups.delete(pendingExecutionGroup);
      successfulExecutionGroups.add(successfulExecutionGroup);
    }

    if (incrementalDataRecords !== undefined) {
      this._addIncrementalDataRecords(
        incrementalDataRecords,
        deferredFragmentRecords,
      );
    }
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
        newRootNodes: ReadonlyArray<DeliveryGroup>;
        successfulExecutionGroups: ReadonlyArray<SuccessfulExecutionGroup>;
      }
    | undefined {
    if (
      !this._rootNodes.has(deferredFragmentRecord) ||
      deferredFragmentRecord.pendingExecutionGroups.size > 0
    ) {
      return;
    }
    const successfulExecutionGroups = Array.from(
      deferredFragmentRecord.successfulExecutionGroups,
    );
    this._rootNodes.delete(deferredFragmentRecord);
    for (const successfulExecutionGroup of successfulExecutionGroups) {
      for (const otherDeferredFragmentRecord of successfulExecutionGroup
        .pendingExecutionGroup.deferredFragmentRecords) {
        otherDeferredFragmentRecord.successfulExecutionGroups.delete(
          successfulExecutionGroup,
        );
      }
    }
    const newRootNodes = this._promoteNonEmptyToRoot(
      deferredFragmentRecord.children,
    );
    return { newRootNodes, successfulExecutionGroups };
  }

  removeDeferredFragment(
    deferredFragmentRecord: DeferredFragmentRecord,
  ): boolean {
    if (!this._rootNodes.has(deferredFragmentRecord)) {
      return false;
    }
    this._rootNodes.delete(deferredFragmentRecord);
    return true;
  }

  removeStream(streamRecord: StreamRecord): void {
    this._rootNodes.delete(streamRecord);
  }

  private _addIncrementalDataRecords(
    incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
    parents: ReadonlyArray<DeferredFragmentRecord> | undefined,
    initialResultChildren?: Set<DeliveryGroup>,
  ): void {
    for (const incrementalDataRecord of incrementalDataRecords) {
      if (isPendingExecutionGroup(incrementalDataRecord)) {
        for (const deferredFragmentRecord of incrementalDataRecord.deferredFragmentRecords) {
          this._addDeferredFragment(
            deferredFragmentRecord,
            initialResultChildren,
          );
          deferredFragmentRecord.pendingExecutionGroups.add(
            incrementalDataRecord,
          );
        }
        if (this._completesRootNode(incrementalDataRecord)) {
          this._onExecutionGroup(incrementalDataRecord);
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
    maybeEmptyNewRootNodes: Set<DeliveryGroup>,
  ): ReadonlyArray<DeliveryGroup> {
    const newRootNodes: Array<DeliveryGroup> = [];
    for (const node of maybeEmptyNewRootNodes) {
      if (isDeferredFragmentRecord(node)) {
        if (node.pendingExecutionGroups.size > 0) {
          for (const pendingExecutionGroup of node.pendingExecutionGroups) {
            if (!this._completesRootNode(pendingExecutionGroup)) {
              this._onExecutionGroup(pendingExecutionGroup);
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
    pendingExecutionGroup: PendingExecutionGroup,
  ): boolean {
    return pendingExecutionGroup.deferredFragmentRecords.some(
      (deferredFragmentRecord) => this._rootNodes.has(deferredFragmentRecord),
    );
  }

  private _addDeferredFragment(
    deferredFragmentRecord: DeferredFragmentRecord,
    initialResultChildren: Set<DeliveryGroup> | undefined,
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

  private _onExecutionGroup(
    pendingExecutionGroup: PendingExecutionGroup,
  ): void {
    let completedExecutionGroup = pendingExecutionGroup.result;
    if (!(completedExecutionGroup instanceof BoxedPromiseOrValue)) {
      completedExecutionGroup = completedExecutionGroup();
    }
    const value = completedExecutionGroup.value;
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

  private _enqueue(completed: IncrementalDataRecordResult): void {
    this._completedQueue.push(completed);
    const next = this._nextQueue.shift();
    if (next === undefined) {
      return;
    }
    next(this.currentCompletedBatch());
  }
}
