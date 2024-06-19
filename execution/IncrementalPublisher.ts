import { invariant } from '../jsutils/invariant.ts';
import type { ObjMap } from '../jsutils/ObjMap.ts';
import { pathToArray } from '../jsutils/Path.ts';
import type { GraphQLError } from '../error/GraphQLError.ts';
import { IncrementalGraph } from './IncrementalGraph.ts';
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
} from './types.ts';
import {
  isCancellableStreamRecord,
  isDeferredGroupedFieldSetResult,
  isNonReconcilableDeferredGroupedFieldSetResult,
} from './types.ts';
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
      if (isDone) {
        await this._returnAsyncIteratorsIgnoringErrors();
        return { value: undefined, done: true };
      }
      const context: SubsequentIncrementalExecutionResultContext = {
        pending: [],
        incremental: [],
        completed: [],
      };
      const completedIncrementalData =
        this._incrementalGraph.completedIncrementalData();
      // use the raw iterator rather than 'for await ... of' so as not to trigger the
      // '.return()' method on the iterator when exiting the loop with the next value
      const asyncIterator = completedIncrementalData[Symbol.asyncIterator]();
      let iteration = await asyncIterator.next();
      while (!iteration.done) {
        for (const completedResult of iteration.value) {
          this._handleCompletedIncrementalData(completedResult, context);
        }
        const { incremental, completed } = context;
        if (incremental.length > 0 || completed.length > 0) {
          const hasNext = this._incrementalGraph.hasNext();
          if (!hasNext) {
            // eslint-disable-next-line require-atomic-updates
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
        iteration = await asyncIterator.next();
      }
      await this._returnAsyncIteratorsIgnoringErrors();
      return { value: undefined, done: true };
    };
    const _return = async (): Promise<
      IteratorResult<SubsequentIncrementalExecutionResult, void>
    > => {
      isDone = true;
      await this._returnAsyncIterators();
      return { value: undefined, done: true };
    };
    const _throw = async (
      error?: unknown,
    ): Promise<IteratorResult<SubsequentIncrementalExecutionResult, void>> => {
      isDone = true;
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
    const newPending = this._incrementalGraph.getNewPending();
    context.pending.push(...this._pendingSourcesToResults(newPending));
  }
  private _handleCompletedDeferredGroupedFieldSet(
    deferredGroupedFieldSetResult: DeferredGroupedFieldSetResult,
    context: SubsequentIncrementalExecutionResultContext,
  ): void {
    if (
      isNonReconcilableDeferredGroupedFieldSetResult(
        deferredGroupedFieldSetResult,
      )
    ) {
      for (const deferredFragmentRecord of deferredGroupedFieldSetResult
        .deferredGroupedFieldSetRecord.deferredFragmentRecords) {
        const id = deferredFragmentRecord.id;
        if (
          !this._incrementalGraph.removeDeferredFragment(deferredFragmentRecord)
        ) {
          // This can occur if multiple deferred grouped field sets error for a fragment.
          continue;
        }
        id !== undefined || invariant(false);
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
    const incrementalDataRecords =
      deferredGroupedFieldSetResult.incrementalDataRecords;
    if (incrementalDataRecords !== undefined) {
      this._incrementalGraph.addIncrementalDataRecords(incrementalDataRecords);
    }
    for (const deferredFragmentRecord of deferredGroupedFieldSetResult
      .deferredGroupedFieldSetRecord.deferredFragmentRecords) {
      const reconcilableResults =
        this._incrementalGraph.completeDeferredFragment(deferredFragmentRecord);
      if (reconcilableResults === undefined) {
        continue;
      }
      const id = deferredFragmentRecord.id;
      id !== undefined || invariant(false);
      const incremental = context.incremental;
      for (const reconcilableResult of reconcilableResults) {
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
        incremental.push(incrementalEntry);
      }
      context.completed.push({ id });
    }
  }
  private _handleCompletedStreamItems(
    streamItemsResult: StreamItemsResult,
    context: SubsequentIncrementalExecutionResultContext,
  ): void {
    const streamRecord = streamItemsResult.streamRecord;
    const id = streamRecord.id;
    id !== undefined || invariant(false);
    if (streamItemsResult.errors !== undefined) {
      context.completed.push({
        id,
        errors: streamItemsResult.errors,
      });
      this._incrementalGraph.removeStream(streamRecord);
      if (isCancellableStreamRecord(streamRecord)) {
        this._context.cancellableStreams !== undefined || invariant(false);
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
        this._context.cancellableStreams !== undefined || invariant(false);
        this._context.cancellableStreams.delete(streamRecord);
      }
    } else {
      const incrementalEntry: IncrementalStreamResult = {
        id,
        ...streamItemsResult.result,
      };
      context.incremental.push(incrementalEntry);
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
  ): {
    bestId: string;
    subPath: ReadonlyArray<string | number> | undefined;
  } {
    let maxLength = pathToArray(initialDeferredFragmentRecord.path).length;
    let bestId = initialId;
    for (const deferredFragmentRecord of deferredGroupedFieldSetResult
      .deferredGroupedFieldSetRecord.deferredFragmentRecords) {
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
  private async _returnAsyncIterators(): Promise<void> {
    await this._incrementalGraph.completedIncrementalData().return();
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
