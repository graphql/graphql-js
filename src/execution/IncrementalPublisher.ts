import { invariant } from '../jsutils/invariant.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import { pathToArray } from '../jsutils/Path.js';

import type { GraphQLError } from '../error/GraphQLError.js';

import { IncrementalGraph } from './IncrementalGraph.js';
import type {
  CancellableStreamRecord,
  CompletedResult,
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

interface SubsequentIncrementalExecutionResultContext {
  pending: Array<PendingResult>;
  incremental: Array<IncrementalResult>;
  completed: Array<CompletedResult>;
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

  constructor(context: IncrementalPublisherContext) {
    this._context = context;
    this._nextId = 0;
    this._incrementalGraph = new IncrementalGraph();
  }

  buildResponse(
    data: ObjMap<unknown>,
    errors: ReadonlyArray<GraphQLError> | undefined,
    incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
  ): ExperimentalIncrementalExecutionResults {
    const newRootNodes = this._incrementalGraph.getNewRootNodes(
      incrementalDataRecords,
    );

    const pending = this._toPendingResults(newRootNodes);

    const initialResult: InitialIncrementalExecutionResult =
      errors === undefined
        ? { data, pending, hasNext: true }
        : { errors, data, pending, hasNext: true };

    return {
      initialResult,
      subsequentResults: this._subscribe(),
    };
  }

  private _toPendingResults(
    newRootNodes: ReadonlyArray<SubsequentResultRecord>,
  ): Array<PendingResult> {
    const pendingResults: Array<PendingResult> = [];
    for (const node of newRootNodes) {
      const id = String(this._getNextId());
      node.id = id;
      const pendingResult: PendingResult = {
        id,
        path: pathToArray(node.path),
      };
      if (node.label !== undefined) {
        pendingResult.label = node.label;
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
      if (isDone) {
        await this._returnAsyncIteratorsIgnoringErrors();
        return { value: undefined, done: true };
      }

      const context: SubsequentIncrementalExecutionResultContext = {
        pending: [],
        incremental: [],
        completed: [],
      };

      let batch: Iterable<IncrementalDataRecordResult> | undefined =
        this._incrementalGraph.currentCompletedBatch();
      do {
        for (const completedResult of batch) {
          this._handleCompletedIncrementalData(completedResult, context);
        }

        const { incremental, completed } = context;
        if (incremental.length > 0 || completed.length > 0) {
          const hasNext = this._incrementalGraph.hasNext();

          if (!hasNext) {
            isDone = true;
          }

          const subsequentIncrementalExecutionResult: SubsequentIncrementalExecutionResult =
            { hasNext };

          const pending = context.pending;
          if (pending.length > 0) {
            subsequentIncrementalExecutionResult.pending = pending;
          }
          if (incremental.length > 0) {
            subsequentIncrementalExecutionResult.incremental = incremental;
          }
          if (completed.length > 0) {
            subsequentIncrementalExecutionResult.completed = completed;
          }

          return { value: subsequentIncrementalExecutionResult, done: false };
        }

        // eslint-disable-next-line no-await-in-loop
        batch = await this._incrementalGraph.nextCompletedBatch();
      } while (batch !== undefined);

      await this._returnAsyncIteratorsIgnoringErrors();
      return { value: undefined, done: true };
    };

    const _return = async (): Promise<
      IteratorResult<SubsequentIncrementalExecutionResult, void>
    > => {
      isDone = true;
      this._incrementalGraph.abort();
      await this._returnAsyncIterators();
      return { value: undefined, done: true };
    };

    const _throw = async (
      error?: unknown,
    ): Promise<IteratorResult<SubsequentIncrementalExecutionResult, void>> => {
      isDone = true;
      this._incrementalGraph.abort();
      await this._returnAsyncIterators();
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

  private _handleCompletedIncrementalData(
    completedIncrementalData: IncrementalDataRecordResult,
    context: SubsequentIncrementalExecutionResultContext,
  ): void {
    if (isDeferredGroupedFieldSetResult(completedIncrementalData)) {
      this._handleCompletedDeferredGroupedFieldSet(
        completedIncrementalData,
        context,
      );
    } else {
      this._handleCompletedStreamItems(completedIncrementalData, context);
    }
  }

  private _handleCompletedDeferredGroupedFieldSet(
    deferredGroupedFieldSetResult: DeferredGroupedFieldSetResult,
    context: SubsequentIncrementalExecutionResultContext,
  ): void {
    const { deferUsages, path } =
      deferredGroupedFieldSetResult.deferredGroupedFieldSetRecord;
    if (
      isNonReconcilableDeferredGroupedFieldSetResult(
        deferredGroupedFieldSetResult,
      )
    ) {
      for (const deferUsage of deferUsages) {
        const id = this._incrementalGraph.removeDeferredFragment(
          deferUsage,
          path,
        );
        if (id === undefined) {
          // This can occur if multiple deferred grouped field sets error for a fragment.
          continue;
        }
        context.completed.push({
          id,
          errors: deferredGroupedFieldSetResult.errors,
        });
      }
      return;
    }

    this._incrementalGraph.addCompletedReconcilableDeferredGroupedFieldSet(
      deferredGroupedFieldSetResult,
    );

    for (const deferUsage of deferUsages) {
      const completion = this._incrementalGraph.completeDeferredFragment(
        deferUsage,
        path,
      );
      if (completion === undefined) {
        continue;
      }
      const incremental = context.incremental;
      const { newRootNodes, reconcilableResults } = completion;
      context.pending.push(...this._toPendingResults(newRootNodes));
      for (const reconcilableResult of reconcilableResults) {
        const { bestId, subPath } = this._incrementalGraph.getBestIdAndSubPath(
          deferUsage,
          reconcilableResult,
        );
        const incrementalEntry: IncrementalDeferResult = {
          ...reconcilableResult.result,
          id: bestId,
        };
        if (subPath !== undefined) {
          incrementalEntry.subPath = subPath;
        }
        incremental.push(incrementalEntry);
      }
      const id = completion.id;
      invariant(id !== undefined);
      context.completed.push({ id });
    }
  }

  private _handleCompletedStreamItems(
    streamItemsResult: StreamItemsResult,
    context: SubsequentIncrementalExecutionResultContext,
  ): void {
    const streamRecord = streamItemsResult.streamRecord;
    const id = streamRecord.id;
    invariant(id !== undefined);
    if (streamItemsResult.errors !== undefined) {
      context.completed.push({
        id,
        errors: streamItemsResult.errors,
      });
      this._incrementalGraph.removeStream(streamRecord);
      if (isCancellableStreamRecord(streamRecord)) {
        invariant(this._context.cancellableStreams !== undefined);
        this._context.cancellableStreams.delete(streamRecord);
        streamRecord.earlyReturn().catch(() => {
          /* c8 ignore next 1 */
          // ignore error
        });
      }
    } else if (streamItemsResult.result === undefined) {
      context.completed.push({ id });
      this._incrementalGraph.removeStream(streamRecord);
      if (isCancellableStreamRecord(streamRecord)) {
        invariant(this._context.cancellableStreams !== undefined);
        this._context.cancellableStreams.delete(streamRecord);
      }
    } else {
      const incrementalEntry: IncrementalStreamResult = {
        id,
        ...streamItemsResult.result,
      };

      context.incremental.push(incrementalEntry);

      const incrementalDataRecords = streamItemsResult.incrementalDataRecords;
      if (incrementalDataRecords !== undefined) {
        const newRootNodes = this._incrementalGraph.getNewRootNodes(
          incrementalDataRecords,
        );
        context.pending.push(...this._toPendingResults(newRootNodes));
      }
    }
  }

  private async _returnAsyncIterators(): Promise<void> {
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
  }

  private async _returnAsyncIteratorsIgnoringErrors(): Promise<void> {
    await this._returnAsyncIterators().catch(() => {
      // Ignore errors
    });
  }
}
