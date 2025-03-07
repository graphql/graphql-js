import { invariant } from '../jsutils/invariant.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import { pathToArray } from '../jsutils/Path.js';

import type { GraphQLError } from '../error/GraphQLError.js';

import type { AbortSignalListener } from './AbortSignalListener.js';
import { IncrementalGraph } from './IncrementalGraph.js';
import type {
  CancellableStreamRecord,
  CompletedExecutionGroup,
  CompletedResult,
  DeferredFragmentRecord,
  DeliveryGroup,
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
} from './types.js';
import {
  isCancellableStreamRecord,
  isCompletedExecutionGroup,
  isFailedExecutionGroup,
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
  abortSignalListener: AbortSignalListener | undefined;
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
    newRootNodes: ReadonlyArray<DeliveryGroup>,
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
        this._context.abortSignalListener?.disconnect();
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

      // TODO: add test for this case
      /* c8 ignore next */
      this._context.abortSignalListener?.disconnect();
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
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
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
    if (isCompletedExecutionGroup(completedIncrementalData)) {
      this._handleCompletedExecutionGroup(completedIncrementalData, context);
    } else {
      this._handleCompletedStreamItems(completedIncrementalData, context);
    }
  }

  private _handleCompletedExecutionGroup(
    completedExecutionGroup: CompletedExecutionGroup,
    context: SubsequentIncrementalExecutionResultContext,
  ): void {
    if (isFailedExecutionGroup(completedExecutionGroup)) {
      for (const deferredFragmentRecord of completedExecutionGroup
        .pendingExecutionGroup.deferredFragmentRecords) {
        const id = deferredFragmentRecord.id;
        if (
          !this._incrementalGraph.removeDeferredFragment(deferredFragmentRecord)
        ) {
          // This can occur if multiple deferred grouped field sets error for a fragment.
          continue;
        }
        invariant(id !== undefined);
        context.completed.push({
          id,
          errors: completedExecutionGroup.errors,
        });
      }
      return;
    }

    this._incrementalGraph.addCompletedSuccessfulExecutionGroup(
      completedExecutionGroup,
    );

    for (const deferredFragmentRecord of completedExecutionGroup
      .pendingExecutionGroup.deferredFragmentRecords) {
      const completion = this._incrementalGraph.completeDeferredFragment(
        deferredFragmentRecord,
      );
      if (completion === undefined) {
        continue;
      }
      const id = deferredFragmentRecord.id;
      invariant(id !== undefined);
      const incremental = context.incremental;
      const { newRootNodes, successfulExecutionGroups } = completion;
      context.pending.push(...this._toPendingResults(newRootNodes));
      for (const successfulExecutionGroup of successfulExecutionGroups) {
        const { bestId, subPath } = this._getBestIdAndSubPath(
          id,
          deferredFragmentRecord,
          successfulExecutionGroup,
        );
        const incrementalEntry: IncrementalDeferResult = {
          ...successfulExecutionGroup.result,
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

  private _getBestIdAndSubPath(
    initialId: string,
    initialDeferredFragmentRecord: DeferredFragmentRecord,
    completedExecutionGroup: CompletedExecutionGroup,
  ): { bestId: string; subPath: ReadonlyArray<string | number> | undefined } {
    let maxLength = pathToArray(initialDeferredFragmentRecord.path).length;
    let bestId = initialId;

    for (const deferredFragmentRecord of completedExecutionGroup
      .pendingExecutionGroup.deferredFragmentRecords) {
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
    const subPath = completedExecutionGroup.path.slice(maxLength);
    return {
      bestId,
      subPath: subPath.length > 0 ? subPath : undefined,
    };
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
