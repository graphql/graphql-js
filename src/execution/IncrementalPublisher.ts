import { invariant } from '../jsutils/invariant.js';
import type { ObjMap } from '../jsutils/ObjMap.js';

import type { GraphQLError } from '../error/GraphQLError.js';

import type { AbortSignalListener } from './AbortSignalListener.js';
import { IncrementalGraph } from './IncrementalGraph.js';
import type {
  PayloadPublisher,
  SubsequentPayloadPublisher,
} from './PayloadPublisher.js';
import type {
  CancellableStreamRecord,
  CompletedExecutionGroup,
  IncrementalDataRecord,
  IncrementalDataRecordResult,
  StreamItemsResult,
} from './types.js';
import {
  isCancellableStreamRecord,
  isCompletedExecutionGroup,
  isFailedExecutionGroup,
} from './types.js';

export interface ExperimentalIncrementalExecutionResults<
  TInitialPayload,
  TSubsequentPayload,
> {
  initialResult: TInitialPayload;
  subsequentResults: AsyncGenerator<TSubsequentPayload, void, void>;
}

export function buildIncrementalResponse<TInitialPayload, TSubsequentPayload>(
  context: IncrementalPublisherContext,
  result: ObjMap<unknown>,
  errors: ReadonlyArray<GraphQLError> | undefined,
  incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
  payloadPublisher: PayloadPublisher<TInitialPayload, TSubsequentPayload>,
): ExperimentalIncrementalExecutionResults<
  TInitialPayload,
  TSubsequentPayload
> {
  const incrementalPublisher = new IncrementalPublisher<
    TInitialPayload,
    TSubsequentPayload
  >(context, payloadPublisher);
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

/**
 * This class is used to publish incremental results to the client, enabling semi-concurrent
 * execution while preserving result order.
 *
 * @internal
 */
class IncrementalPublisher<TInitialPayload, TSubsequentPayload> {
  private _context: IncrementalPublisherContext;
  private _payloadPublisher: PayloadPublisher<
    TInitialPayload,
    TSubsequentPayload
  >;
  private _incrementalGraph: IncrementalGraph;

  constructor(
    publisherContext: IncrementalPublisherContext,
    payloadPublisher: PayloadPublisher<TInitialPayload, TSubsequentPayload>,
  ) {
    this._context = publisherContext;
    this._payloadPublisher = payloadPublisher;
    this._incrementalGraph = new IncrementalGraph();
  }

  buildResponse(
    data: ObjMap<unknown>,
    errors: ReadonlyArray<GraphQLError> | undefined,
    incrementalDataRecords: ReadonlyArray<IncrementalDataRecord>,
  ): ExperimentalIncrementalExecutionResults<
    TInitialPayload,
    TSubsequentPayload
  > {
    const newRootNodes = this._incrementalGraph.getNewRootNodes(
      incrementalDataRecords,
    );

    const initialResult = this._payloadPublisher.getInitialPayload(
      data,
      errors,
      newRootNodes,
    );

    return {
      initialResult,
      subsequentResults: this._subscribe(),
    };
  }

  private _subscribe(): AsyncGenerator<TSubsequentPayload, void, void> {
    let isDone = false;

    const _next = async (): Promise<
      IteratorResult<TSubsequentPayload, void>
    > => {
      if (isDone) {
        this._context.abortSignalListener?.disconnect();
        await this._returnAsyncIteratorsIgnoringErrors();
        return { value: undefined, done: true };
      }

      const payloadPublisher =
        this._payloadPublisher.getSubsequentPayloadPublisher();

      let batch: Iterable<IncrementalDataRecordResult> | undefined =
        this._incrementalGraph.currentCompletedBatch();
      do {
        for (const completedResult of batch) {
          this._handleCompletedIncrementalData(
            completedResult,
            payloadPublisher,
          );
        }

        const hasNext = this._incrementalGraph.hasNext();
        const subsequentPayload =
          payloadPublisher.getSubsequentPayload(hasNext);

        if (subsequentPayload !== undefined) {
          if (!hasNext) {
            isDone = true;
          }

          return { value: subsequentPayload, done: false };
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
      IteratorResult<TSubsequentPayload, void>
    > => {
      isDone = true;
      this._incrementalGraph.abort();
      await this._returnAsyncIterators();
      return { value: undefined, done: true };
    };

    const _throw = async (
      error?: unknown,
    ): Promise<IteratorResult<TSubsequentPayload, void>> => {
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
    payloadPublisher: SubsequentPayloadPublisher<TSubsequentPayload>,
  ): void {
    if (isCompletedExecutionGroup(completedIncrementalData)) {
      this._handleCompletedExecutionGroup(
        completedIncrementalData,
        payloadPublisher,
      );
    } else {
      this._handleCompletedStreamItems(
        completedIncrementalData,
        payloadPublisher,
      );
    }
  }

  private _handleCompletedExecutionGroup(
    completedExecutionGroup: CompletedExecutionGroup,
    payloadPublisher: SubsequentPayloadPublisher<TSubsequentPayload>,
  ): void {
    if (isFailedExecutionGroup(completedExecutionGroup)) {
      for (const deferredFragmentRecord of completedExecutionGroup
        .pendingExecutionGroup.deferredFragmentRecords) {
        if (
          !this._incrementalGraph.removeDeferredFragment(deferredFragmentRecord)
        ) {
          // This can occur if multiple deferred grouped field sets error for a fragment.
          continue;
        }

        payloadPublisher.addFailedDeferredFragmentRecord(
          deferredFragmentRecord,
          completedExecutionGroup,
        );
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

      payloadPublisher.addSuccessfulDeferredFragmentRecord(
        deferredFragmentRecord,
        completion.newRootNodes,
        completion.successfulExecutionGroups,
      );
    }
  }

  private _handleCompletedStreamItems(
    streamItemsResult: StreamItemsResult,
    payloadPublisher: SubsequentPayloadPublisher<TSubsequentPayload>,
  ): void {
    const streamRecord = streamItemsResult.streamRecord;
    if (streamItemsResult.errors !== undefined) {
      payloadPublisher.addFailedStreamRecord(
        streamRecord,
        streamItemsResult.errors,
      );
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
      payloadPublisher.addSuccessfulStreamRecord(streamRecord);
      this._incrementalGraph.removeStream(streamRecord);
      if (isCancellableStreamRecord(streamRecord)) {
        invariant(this._context.cancellableStreams !== undefined);
        this._context.cancellableStreams.delete(streamRecord);
      }
    } else {
      const { result, incrementalDataRecords } = streamItemsResult;

      const newRootNodes =
        incrementalDataRecords &&
        this._incrementalGraph.getNewRootNodes(incrementalDataRecords);

      payloadPublisher.addStreamItems(streamRecord, newRootNodes, result);
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
