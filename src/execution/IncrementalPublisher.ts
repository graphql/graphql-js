import type { ObjMap } from '../jsutils/ObjMap.js';
import { pathToArray } from '../jsutils/Path.js';

import type { GraphQLError } from '../error/GraphQLError.js';

import type { AbortSignalListener } from './AbortSignalListener.js';
import { mapAsyncIterable } from './mapAsyncIterable.js';
import type {
  CompletedResult,
  DeferredFragmentRecord,
  ExecutionGroupValue,
  ExperimentalIncrementalExecutionResults,
  IncrementalDeferResult,
  IncrementalResult,
  IncrementalWork,
  InitialIncrementalExecutionResult,
  PendingResult,
  StreamItemValue,
  StreamRecord,
  SubsequentIncrementalExecutionResult,
} from './types.js';
import { withCleanup } from './withCleanup.js';
import type { WorkQueueEvent } from './WorkQueue.js';
import { createWorkQueue } from './WorkQueue.js';

export function buildIncrementalResponse(
  result: ObjMap<unknown>,
  errors: ReadonlyArray<GraphQLError>,
  work: IncrementalWork,
  earlyReturns: Map<StreamRecord, () => Promise<unknown>>,
  abortSignalListener: AbortSignalListener | undefined,
): ExperimentalIncrementalExecutionResults {
  const incrementalPublisher = new IncrementalPublisher(
    earlyReturns,
    abortSignalListener,
  );
  return incrementalPublisher.buildResponse(result, errors, work);
}

interface SubsequentIncrementalExecutionResultContext {
  pending: Array<PendingResult>;
  incremental: Array<IncrementalResult>;
  completed: Array<CompletedResult>;
  hasNext: boolean;
}

/**
 * @internal
 */
export class IncrementalPublisher {
  private _ids: Map<DeferredFragmentRecord | StreamRecord, string>;
  private _earlyReturns: Map<StreamRecord, () => Promise<unknown>>;
  private _abortSignalListener: AbortSignalListener | undefined;
  private _nextId: number;

  constructor(
    earlyReturns: Map<StreamRecord, () => Promise<unknown>>,
    abortSignalListener: AbortSignalListener | undefined,
  ) {
    this._ids = new Map();
    this._earlyReturns = earlyReturns;
    this._abortSignalListener = abortSignalListener;
    this._nextId = 0;
  }

  buildResponse(
    data: ObjMap<unknown>,
    errors: ReadonlyArray<GraphQLError>,
    work: IncrementalWork,
  ): ExperimentalIncrementalExecutionResults {
    const { initialGroups, initialStreams, events } = createWorkQueue<
      ExecutionGroupValue,
      StreamItemValue,
      DeferredFragmentRecord,
      StreamRecord
    >(work);

    const pending = this._toPendingResults(initialGroups, initialStreams);

    const initialResult: InitialIncrementalExecutionResult = errors.length
      ? { errors, data, pending, hasNext: true }
      : { data, pending, hasNext: true };

    const subsequentResults = mapAsyncIterable(events, (batch) =>
      this._handleBatch(batch),
    );

    return {
      initialResult,
      subsequentResults: withCleanup(subsequentResults, async () => {
        this._abortSignalListener?.disconnect();
        await this._returnAsyncIteratorsIgnoringErrors();
      }),
    };
  }

  private _ensureId(
    deferredFragmentOrStream: DeferredFragmentRecord | StreamRecord,
  ): string {
    let id = this._ids.get(deferredFragmentOrStream);
    if (id !== undefined) {
      return id;
    }
    id = String(this._nextId++);
    this._ids.set(deferredFragmentOrStream, id);
    return id;
  }

  private _toPendingResults(
    newGroups: ReadonlyArray<DeferredFragmentRecord>,
    newStreams: ReadonlyArray<StreamRecord>,
  ): Array<PendingResult> {
    const pendingResults: Array<PendingResult> = [];
    for (const collection of [newGroups, newStreams]) {
      for (const node of collection) {
        const id = this._ensureId(node);
        const pendingResult: PendingResult = {
          id,
          path: pathToArray(node.path),
        };
        if (node.label !== undefined) {
          pendingResult.label = node.label;
        }
        pendingResults.push(pendingResult);
      }
    }
    return pendingResults;
  }

  private _handleBatch(
    batch: ReadonlyArray<
      WorkQueueEvent<
        ExecutionGroupValue,
        StreamItemValue,
        DeferredFragmentRecord,
        StreamRecord
      >
    >,
  ): SubsequentIncrementalExecutionResult {
    const context: SubsequentIncrementalExecutionResultContext = {
      pending: [],
      incremental: [],
      completed: [],
      hasNext: true,
    };

    for (const event of batch) {
      this._handleWorkQueueEvent(event, context);
    }

    const { incremental, completed, pending, hasNext } = context;

    const result: SubsequentIncrementalExecutionResult = { hasNext };
    if (pending.length > 0) {
      result.pending = pending;
    }
    if (incremental.length > 0) {
      result.incremental = incremental;
    }
    if (completed.length > 0) {
      result.completed = completed;
    }
    return result;
  }

  private _handleWorkQueueEvent(
    event: WorkQueueEvent<
      ExecutionGroupValue,
      StreamItemValue,
      DeferredFragmentRecord,
      StreamRecord
    >,
    context: SubsequentIncrementalExecutionResultContext,
  ): void {
    switch (event.kind) {
      case 'GROUP_VALUES': {
        const group = event.group;
        const id = this._ensureId(group);
        for (const value of event.values) {
          const { bestId, subPath } = this._getBestIdAndSubPath(
            id,
            group,
            value,
          );
          const incrementalEntry: IncrementalDeferResult = {
            id: bestId,
            data: value.data,
          };
          if (value.errors !== undefined) {
            incrementalEntry.errors = value.errors;
          }
          if (subPath !== undefined) {
            incrementalEntry.subPath = subPath;
          }
          context.incremental.push(incrementalEntry);
        }
        break;
      }
      case 'GROUP_SUCCESS': {
        const group = event.group;
        const id = this._ensureId(group);
        context.completed.push({ id });
        this._ids.delete(group);
        if (event.newGroups.length > 0 || event.newStreams.length > 0) {
          context.pending.push(
            ...this._toPendingResults(event.newGroups, event.newStreams),
          );
        }
        break;
      }
      case 'GROUP_FAILURE': {
        const { group, error } = event;
        const id = this._ensureId(group);
        context.completed.push({
          id,
          errors: [error as GraphQLError],
        });
        this._ids.delete(group);
        break;
      }
      case 'STREAM_VALUES': {
        const stream = event.stream;
        const id = this._ensureId(stream);
        const { values, newGroups, newStreams } = event;
        const items: Array<unknown> = [];
        const errors: Array<GraphQLError> = [];
        for (const value of values) {
          items.push(value.item);
          if (value.errors !== undefined) {
            errors.push(...value.errors);
          }
        }
        context.incremental.push(
          errors.length > 0 ? { id, items, errors } : { id, items },
        );
        if (newGroups.length > 0 || newStreams.length > 0) {
          context.pending.push(
            ...this._toPendingResults(newGroups, newStreams),
          );
        }
        break;
      }
      case 'STREAM_SUCCESS': {
        const stream = event.stream;
        context.completed.push({
          id: this._ensureId(stream),
        });
        this._ids.delete(stream);
        this._earlyReturns.delete(stream);
        break;
      }
      case 'STREAM_FAILURE': {
        const stream = event.stream;
        context.completed.push({
          id: this._ensureId(stream),
          errors: [event.error as GraphQLError],
        });
        this._ids.delete(stream);
        const earlyReturn = this._earlyReturns.get(stream);
        if (earlyReturn !== undefined) {
          earlyReturn().catch(() => {
            /* c8 ignore next 1 */
            // ignore error
          });
          this._earlyReturns.delete(stream);
        }
        break;
      }
      case 'WORK_QUEUE_TERMINATION': {
        context.hasNext = false;
        break;
      }
    }
  }

  private _getBestIdAndSubPath(
    initialId: string,
    initialDeferredFragmentRecord: DeferredFragmentRecord,
    executionGroupValue: ExecutionGroupValue,
  ): { bestId: string; subPath: ReadonlyArray<string | number> | undefined } {
    let maxLength = pathToArray(initialDeferredFragmentRecord.path).length;
    let bestId = initialId;

    for (const deferredFragmentRecord of executionGroupValue.deferredFragmentRecords) {
      if (deferredFragmentRecord === initialDeferredFragmentRecord) {
        continue;
      }
      const id = this._ids.get(deferredFragmentRecord);
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
    const subPath = executionGroupValue.path.slice(maxLength);
    return {
      bestId,
      subPath: subPath.length > 0 ? subPath : undefined,
    };
  }

  private async _returnAsyncIterators(): Promise<void> {
    const promises: Array<Promise<unknown>> = [];
    for (const earlyReturn of this._earlyReturns.values()) {
      if (earlyReturn !== undefined) {
        promises.push(earlyReturn());
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
