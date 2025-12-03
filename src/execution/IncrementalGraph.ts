import { BoxedPromiseOrValue } from '../jsutils/BoxedPromiseOrValue.js';
import { invariant } from '../jsutils/invariant.js';
import { isPromise } from '../jsutils/isPromise.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';

import type { GraphQLError } from '../error/GraphQLError.js';

import { Queue } from './Queue.js';
import type {
  DeferredFragmentRecord,
  DeliveryGroup,
  IncrementalDataRecord,
  IncrementalDataRecordResult,
  PendingExecutionGroup,
  StreamRecord,
  SuccessfulExecutionGroup,
} from './types.js';
import { isDeferredFragmentRecord, isPendingExecutionGroup } from './types.js';

/**
 * @internal
 */
export class IncrementalGraph<U> {
  private _rootNodes: Set<DeliveryGroup>;
  private _completed: AsyncGenerator<U, void, void>;
  // _push and _stop are assigned in the executor which is executed
  // synchronously by the Queue constructor.
  private _push!: (item: IncrementalDataRecordResult) => PromiseOrValue<void>;
  private _stop!: () => void;

  constructor(
    reducer: (
      generator: Generator<IncrementalDataRecordResult>,
    ) => U | undefined,
  ) {
    this._rootNodes = new Set();
    this._completed = new Queue<IncrementalDataRecordResult>(
      ({ push, stop }) => {
        this._push = push;
        this._stop = stop;
      },
    ).subscribe(reducer);
  }

  getNewRootNodes(
    newDeferredFragmentRecords:
      | ReadonlyArray<DeferredFragmentRecord>
      | undefined,
    incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
  ): ReadonlyArray<DeliveryGroup> {
    const initialResultChildren = new Set<DeliveryGroup>();

    if (newDeferredFragmentRecords !== undefined) {
      for (const deferredFragmentRecord of newDeferredFragmentRecords) {
        this._addDeferredFragment(
          deferredFragmentRecord,
          initialResultChildren,
        );
      }
    }

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
    const {
      pendingExecutionGroup,
      newDeferredFragmentRecords,
      incrementalDataRecords,
    } = successfulExecutionGroup;

    if (newDeferredFragmentRecords !== undefined) {
      for (const deferredFragmentRecord of newDeferredFragmentRecords) {
        this._addDeferredFragment(deferredFragmentRecord, undefined);
      }
    }

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
    this._maybeStop();
    return { newRootNodes, successfulExecutionGroups };
  }

  removeDeferredFragment(
    deferredFragmentRecord: DeferredFragmentRecord,
  ): boolean {
    const deleted = this._rootNodes.delete(deferredFragmentRecord);
    if (!deleted) {
      return false;
    }
    this._maybeStop();
    return true;
  }

  removeStream(streamRecord: StreamRecord): void {
    this._rootNodes.delete(streamRecord);
    this._maybeStop();
  }

  subscribe(): AsyncGenerator<U, void, void> {
    return this._completed;
  }

  private _addIncrementalDataRecords(
    incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
    parents: ReadonlyArray<DeferredFragmentRecord> | undefined,
    initialResultChildren?: Set<DeliveryGroup>,
  ): void {
    for (const incrementalDataRecord of incrementalDataRecords) {
      if (isPendingExecutionGroup(incrementalDataRecord)) {
        for (const deferredFragmentRecord of incrementalDataRecord.deferredFragmentRecords) {
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
    const parent = deferredFragmentRecord.parent;
    if (parent === undefined) {
      invariant(initialResultChildren !== undefined);
      initialResultChildren.add(deferredFragmentRecord);
      return;
    }
    parent.children.add(deferredFragmentRecord);
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
      value.then((resolved) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this._push(resolved);
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this._push(value);
    }
  }

  private async _onStreamItems(streamRecord: StreamRecord): Promise<void> {
    const streamItemQueue = streamRecord.streamItemQueue;
    let closed = false;
    try {
      await streamItemQueue.forEachBatch((streamItemResults) => {
        const items: Array<unknown> = [];
        const errors: Array<GraphQLError> = [];
        const newDeferredFragmentRecords: Array<DeferredFragmentRecord> = [];
        const incrementalDataRecords: Array<IncrementalDataRecord> = [];

        for (const result of streamItemResults) {
          items.push(result.item);
          if (result.errors !== undefined) {
            errors.push(...result.errors);
          }
          if (result.newDeferredFragmentRecords !== undefined) {
            newDeferredFragmentRecords.push(
              ...result.newDeferredFragmentRecords,
            );
          }
          if (result.incrementalDataRecords !== undefined) {
            incrementalDataRecords.push(...result.incrementalDataRecords);
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this._push({
          streamRecord,
          result:
            // TODO add additional test case or rework for coverage
            errors.length > 0 /* c8 ignore start */
              ? { items, errors } /* c8 ignore stop */
              : { items },
          newDeferredFragmentRecords,
          incrementalDataRecords,
        });

        if (streamItemQueue.isStopped()) {
          closed = true;
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this._push({ streamRecord });
        }
      });
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this._push({ streamRecord, errors: [error] });
      return;
    }

    if (!closed) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this._push({ streamRecord });
    }
  }

  private _maybeStop(): void {
    if (!this.hasNext()) {
      this._stop();
    }
  }
}
