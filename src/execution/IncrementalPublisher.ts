import { invariant } from '../jsutils/invariant.js';
import { isPromise } from '../jsutils/isPromise.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import { pathToArray } from '../jsutils/Path.js';
import { promiseWithResolvers } from '../jsutils/promiseWithResolvers.js';

import type { GraphQLError } from '../error/GraphQLError.js';

import type {
  CancellableStreamRecord,
  CompletedResult,
  DeferredFragmentRecord,
  DeferredGroupedFieldSetResult,
  ExperimentalIncrementalExecutionResults,
  IncrementalDataRecord,
  IncrementalDataRecordResult,
  IncrementalDeferResult,
  IncrementalResult,
  IncrementalStreamResult,
  InitialIncrementalExecutionResult,
  PendingResult,
  StreamItemsResult,
  SubsequentIncrementalExecutionResult,
  SubsequentResultRecord,
} from './types.js';
import {
  isCancellableStreamRecord,
  isDeferredFragmentRecord,
  isDeferredGroupedFieldSetRecord,
  isDeferredGroupedFieldSetResult,
  isNonReconcilableDeferredGroupedFieldSetResult,
} from './types.js';

export function buildIncrementalResponse(
  context: IncrementalPublisherContext,
  result: ObjMap<unknown>,
  errors: ReadonlyArray<GraphQLError> | undefined,
  incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
): ExperimentalIncrementalExecutionResults {
  const incrementalPublisher = new IncrementalPublisher(context);
  return incrementalPublisher.buildResponse(
    result,
    errors,
    incrementalDataRecords,
  );
}

interface IncrementalPublisherContext {
  cancellableStreams: Set<CancellableStreamRecord> | undefined;
}

/**
 * This class is used to publish incremental results to the client, enabling semi-concurrent
 * execution while preserving result order.
 *
 * @internal
 */
class IncrementalPublisher {
  private _context: IncrementalPublisherContext;
  private _nextId: number;
  private _pending: Set<SubsequentResultRecord>;
  private _completedResultQueue: Array<IncrementalDataRecordResult>;
  private _newPending: Set<SubsequentResultRecord>;
  private _incremental: Array<IncrementalResult>;
  private _completed: Array<CompletedResult>;
  // these are assigned within the Promise executor called synchronously within the constructor
  private _signalled!: Promise<unknown>;
  private _resolve!: () => void;

  constructor(context: IncrementalPublisherContext) {
    this._context = context;
    this._nextId = 0;
    this._pending = new Set();
    this._completedResultQueue = [];
    this._newPending = new Set();
    this._incremental = [];
    this._completed = [];
    this._reset();
  }

  buildResponse(
    data: ObjMap<unknown>,
    errors: ReadonlyArray<GraphQLError> | undefined,
    incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
  ): ExperimentalIncrementalExecutionResults {
    this._addIncrementalDataRecords(incrementalDataRecords);
    this._pruneEmpty();

    const pending = this._pendingSourcesToResults();

    const initialResult: InitialIncrementalExecutionResult =
      errors === undefined
        ? { data, pending, hasNext: true }
        : { errors, data, pending, hasNext: true };

    return {
      initialResult,
      subsequentResults: this._subscribe(),
    };
  }

  private _addIncrementalDataRecords(
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

  private _pruneEmpty() {
    const maybeEmptyNewPending = this._newPending;
    this._newPending = new Set();
    for (const node of maybeEmptyNewPending) {
      if (isDeferredFragmentRecord(node)) {
        if (node.expectedReconcilableResults) {
          this._newPending.add(node);
          continue;
        }
        for (const child of node.children) {
          this._addNonEmptyNewPending(child);
        }
      } else {
        this._newPending.add(node);
      }
    }
  }

  private _addNonEmptyNewPending(
    deferredFragmentRecord: DeferredFragmentRecord,
  ): void {
    if (deferredFragmentRecord.expectedReconcilableResults) {
      this._newPending.add(deferredFragmentRecord);
      return;
    }
    /* c8 ignore next 5 */
    // TODO: add test case for this, if when skipping an empty deferred fragment, the empty fragment has nested children.
    for (const child of deferredFragmentRecord.children) {
      this._addNonEmptyNewPending(child);
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

  private _pendingSourcesToResults(): Array<PendingResult> {
    const pendingResults: Array<PendingResult> = [];
    for (const pendingSource of this._newPending) {
      const id = String(this._getNextId());
      this._pending.add(pendingSource);
      pendingSource.id = id;
      const pendingResult: PendingResult = {
        id,
        path: pathToArray(pendingSource.path),
      };
      if (pendingSource.label !== undefined) {
        pendingResult.label = pendingSource.label;
      }
      pendingResults.push(pendingResult);
    }
    this._newPending.clear();
    return pendingResults;
  }

  private _getNextId(): string {
    return String(this._nextId++);
  }

  private _subscribe(): AsyncGenerator<
    SubsequentIncrementalExecutionResult,
    void,
    void
  > {
    let isDone = false;

    const _next = async (): Promise<
      IteratorResult<SubsequentIncrementalExecutionResult, void>
    > => {
      while (!isDone) {
        let pending: Array<PendingResult> = [];

        let completedResult: IncrementalDataRecordResult | undefined;
        while (
          (completedResult = this._completedResultQueue.shift()) !== undefined
        ) {
          if (isDeferredGroupedFieldSetResult(completedResult)) {
            this._handleCompletedDeferredGroupedFieldSet(completedResult);
          } else {
            this._handleCompletedStreamItems(completedResult);
          }

          pending = [...pending, ...this._pendingSourcesToResults()];
        }

        if (this._incremental.length > 0 || this._completed.length > 0) {
          const hasNext = this._pending.size > 0;

          if (!hasNext) {
            isDone = true;
          }

          const subsequentIncrementalExecutionResult: SubsequentIncrementalExecutionResult =
            { hasNext };

          if (pending.length > 0) {
            subsequentIncrementalExecutionResult.pending = pending;
          }
          if (this._incremental.length > 0) {
            subsequentIncrementalExecutionResult.incremental =
              this._incremental;
          }
          if (this._completed.length > 0) {
            subsequentIncrementalExecutionResult.completed = this._completed;
          }

          this._incremental = [];
          this._completed = [];

          return { value: subsequentIncrementalExecutionResult, done: false };
        }

        // eslint-disable-next-line no-await-in-loop
        await this._signalled;
      }

      await returnStreamIterators().catch(() => {
        // ignore errors
      });

      return { value: undefined, done: true };
    };

    const returnStreamIterators = async (): Promise<void> => {
      const cancellableStreams = this._context.cancellableStreams;
      if (cancellableStreams === undefined) {
        return;
      }
      const promises: Array<Promise<unknown>> = [];
      for (const streamRecord of cancellableStreams) {
        if (streamRecord.earlyReturn !== undefined) {
          promises.push(streamRecord.earlyReturn());
        }
      }
      await Promise.all(promises);
    };

    const _return = async (): Promise<
      IteratorResult<SubsequentIncrementalExecutionResult, void>
    > => {
      isDone = true;
      await returnStreamIterators();
      return { value: undefined, done: true };
    };

    const _throw = async (
      error?: unknown,
    ): Promise<IteratorResult<SubsequentIncrementalExecutionResult, void>> => {
      isDone = true;
      await returnStreamIterators();
      return Promise.reject(error);
    };

    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      next: _next,
      return: _return,
      throw: _throw,
    };
  }

  private _trigger() {
    this._resolve();
    this._reset();
  }

  private _reset() {
    // promiseWithResolvers uses void only as a generic type parameter
    // see: https://typescript-eslint.io/rules/no-invalid-void-type/
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    const { promise: signalled, resolve } = promiseWithResolvers<void>();
    this._resolve = resolve;
    this._signalled = signalled;
  }

  private _handleCompletedDeferredGroupedFieldSet(
    deferredGroupedFieldSetResult: DeferredGroupedFieldSetResult,
  ): void {
    if (
      isNonReconcilableDeferredGroupedFieldSetResult(
        deferredGroupedFieldSetResult,
      )
    ) {
      for (const deferredFragmentRecord of deferredGroupedFieldSetResult.deferredFragmentRecords) {
        const id = deferredFragmentRecord.id;
        if (id !== undefined) {
          this._completed.push({
            id,
            errors: deferredGroupedFieldSetResult.errors,
          });
          this._pending.delete(deferredFragmentRecord);
        }
      }
      return;
    }
    for (const deferredFragmentRecord of deferredGroupedFieldSetResult.deferredFragmentRecords) {
      deferredFragmentRecord.reconcilableResults.push(
        deferredGroupedFieldSetResult,
      );
    }

    const incrementalDataRecords =
      deferredGroupedFieldSetResult.incrementalDataRecords;
    if (incrementalDataRecords !== undefined) {
      this._addIncrementalDataRecords(incrementalDataRecords);
    }

    for (const deferredFragmentRecord of deferredGroupedFieldSetResult.deferredFragmentRecords) {
      const id = deferredFragmentRecord.id;
      // TODO: add test case for this.
      // Presumably, this can occur if an error causes a fragment to be completed early,
      // while an asynchronous deferred grouped field set result is enqueued.
      /* c8 ignore next 3 */
      if (id === undefined) {
        continue;
      }
      const reconcilableResults = deferredFragmentRecord.reconcilableResults;
      if (
        deferredFragmentRecord.expectedReconcilableResults !==
        reconcilableResults.length
      ) {
        continue;
      }
      for (const reconcilableResult of reconcilableResults) {
        if (reconcilableResult.sent) {
          continue;
        }
        reconcilableResult.sent = true;
        const { bestId, subPath } = this._getBestIdAndSubPath(
          id,
          deferredFragmentRecord,
          reconcilableResult,
        );
        const incrementalEntry: IncrementalDeferResult = {
          ...reconcilableResult.result,
          id: bestId,
        };
        if (subPath !== undefined) {
          incrementalEntry.subPath = subPath;
        }
        this._incremental.push(incrementalEntry);
      }
      this._completed.push({ id });
      this._pending.delete(deferredFragmentRecord);
      for (const child of deferredFragmentRecord.children) {
        this._newPending.add(child);
        this._completedResultQueue.push(...child.results);
      }
    }

    this._pruneEmpty();
  }

  private _handleCompletedStreamItems(
    streamItemsResult: StreamItemsResult,
  ): void {
    const streamRecord = streamItemsResult.streamRecord;
    const id = streamRecord.id;
    // TODO: Consider adding invariant or non-null assertion, as this should never happen. Since the stream is converted into a linked list
    // for ordering purposes, if an entry errors, additional entries will not be processed.
    /* c8 ignore next 3 */
    if (id === undefined) {
      return;
    }
    if (streamItemsResult.errors !== undefined) {
      this._completed.push({
        id,
        errors: streamItemsResult.errors,
      });
      this._pending.delete(streamRecord);
      if (isCancellableStreamRecord(streamRecord)) {
        invariant(this._context.cancellableStreams !== undefined);
        this._context.cancellableStreams.delete(streamRecord);
        streamRecord.earlyReturn().catch(() => {
          /* c8 ignore next 1 */
          // ignore error
        });
      }
    } else if (streamItemsResult.result === undefined) {
      this._completed.push({ id });
      this._pending.delete(streamRecord);
      if (isCancellableStreamRecord(streamRecord)) {
        invariant(this._context.cancellableStreams !== undefined);
        this._context.cancellableStreams.delete(streamRecord);
      }
    } else {
      const incrementalEntry: IncrementalStreamResult = {
        id,
        ...streamItemsResult.result,
      };

      this._incremental.push(incrementalEntry);

      if (streamItemsResult.incrementalDataRecords !== undefined) {
        this._addIncrementalDataRecords(
          streamItemsResult.incrementalDataRecords,
        );
        this._pruneEmpty();
      }
    }
  }

  private _getBestIdAndSubPath(
    initialId: string,
    initialDeferredFragmentRecord: DeferredFragmentRecord,
    deferredGroupedFieldSetResult: DeferredGroupedFieldSetResult,
  ): { bestId: string; subPath: ReadonlyArray<string | number> | undefined } {
    let maxLength = pathToArray(initialDeferredFragmentRecord.path).length;
    let bestId = initialId;

    for (const deferredFragmentRecord of deferredGroupedFieldSetResult.deferredFragmentRecords) {
      if (deferredFragmentRecord === initialDeferredFragmentRecord) {
        continue;
      }
      const id = deferredFragmentRecord.id;
      // TODO: add test case for when an fragment has not been released, but might be processed for the shortest path.
      /* c8 ignore next 3 */
      if (id === undefined) {
        continue;
      }
      const fragmentPath = pathToArray(deferredFragmentRecord.path);
      const length = fragmentPath.length;
      if (length > maxLength) {
        maxLength = length;
        bestId = id;
      }
    }
    const subPath = deferredGroupedFieldSetResult.path.slice(maxLength);
    return {
      bestId,
      subPath: subPath.length > 0 ? subPath : undefined,
    };
  }
}
