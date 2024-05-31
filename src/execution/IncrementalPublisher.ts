import { invariant } from '../jsutils/invariant.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import { pathToArray } from '../jsutils/Path.js';

import type { GraphQLError } from '../error/GraphQLError.js';

import { IncrementalGraph } from './IncrementalGraph.js';
import type {
  CancellableStreamRecord,
  CompletedResult,
  DeferredFragmentRecord,
  DeferredGroupedFieldSetResult,
  ExperimentalIncrementalExecutionResults,
  IncrementalDataRecord,
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
  private _incrementalGraph: IncrementalGraph;
  private _incremental: Array<IncrementalResult>;
  private _completed: Array<CompletedResult>;

  constructor(context: IncrementalPublisherContext) {
    this._context = context;
    this._nextId = 0;
    this._incrementalGraph = new IncrementalGraph();
    this._incremental = [];
    this._completed = [];
  }

  buildResponse(
    data: ObjMap<unknown>,
    errors: ReadonlyArray<GraphQLError> | undefined,
    incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
  ): ExperimentalIncrementalExecutionResults {
    this._incrementalGraph.addIncrementalDataRecords(incrementalDataRecords);
    const newPending = this._incrementalGraph.getNewPending();

    const pending = this._pendingSourcesToResults(newPending);

    const initialResult: InitialIncrementalExecutionResult =
      errors === undefined
        ? { data, pending, hasNext: true }
        : { errors, data, pending, hasNext: true };

    return {
      initialResult,
      subsequentResults: this._subscribe(),
    };
  }

  private _pendingSourcesToResults(
    newPending: ReadonlyArray<SubsequentResultRecord>,
  ): Array<PendingResult> {
    const pendingResults: Array<PendingResult> = [];
    for (const pendingSource of newPending) {
      const id = String(this._getNextId());
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

        for (const completedResult of this._incrementalGraph.completedResults()) {
          if (isDeferredGroupedFieldSetResult(completedResult)) {
            this._handleCompletedDeferredGroupedFieldSet(completedResult);
          } else {
            this._handleCompletedStreamItems(completedResult);
          }

          const newPending = this._incrementalGraph.getNewPending();
          pending = [...pending, ...this._pendingSourcesToResults(newPending)];
        }

        if (this._incremental.length > 0 || this._completed.length > 0) {
          const hasNext = this._incrementalGraph.hasNext();

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
        await this._incrementalGraph.newCompletedResultAvailable;
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
          this._incrementalGraph.removeSubsequentResultRecord(
            deferredFragmentRecord,
          );
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
      this._incrementalGraph.addIncrementalDataRecords(incrementalDataRecords);
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
      const reconcilableResults =
        this._incrementalGraph.completeDeferredFragment(deferredFragmentRecord);
      if (reconcilableResults === undefined) {
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
    }
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
      this._incrementalGraph.removeSubsequentResultRecord(streamRecord);
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
      this._incrementalGraph.removeSubsequentResultRecord(streamRecord);
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
        this._incrementalGraph.addIncrementalDataRecords(
          streamItemsResult.incrementalDataRecords,
        );
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
