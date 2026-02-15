import type { ObjMap } from '../../jsutils/ObjMap.js';
import { addPath, pathToArray } from '../../jsutils/Path.js';

import type { GraphQLError } from '../../error/GraphQLError.js';

import type {
  DeliveryGroup,
  ExecutionGroupValue,
  IncrementalWork,
  ItemStream,
  StreamItemValue,
} from '../incremental/IncrementalExecutor.js';
import type { WorkQueueEvent } from '../incremental/WorkQueue.js';
import { createWorkQueue } from '../incremental/WorkQueue.js';
import { mapAsyncIterable } from '../mapAsyncIterable.js';
import { withConcurrentAbruptClose } from '../withConcurrentAbruptClose.js';

import type {
  LegacyExperimentalIncrementalExecutionResults,
  LegacyIncrementalDeferResult,
  LegacyIncrementalResult,
  LegacyIncrementalStreamResult,
  LegacyInitialIncrementalExecutionResult,
  LegacySubsequentIncrementalExecutionResult,
} from './BranchingIncrementalExecutor.js';

interface SubsequentIncrementalExecutionResultContext {
  incremental: Array<LegacyIncrementalResult>;
  hasNext: boolean;
}

/**
 * @internal
 */
export class BranchingIncrementalPublisher {
  private _indices: Map<ItemStream, number>;

  constructor() {
    this._indices = new Map();
  }

  buildResponse(
    data: ObjMap<unknown>,
    errors: ReadonlyArray<GraphQLError>,
    work: IncrementalWork,
    abortSignal: AbortSignal | undefined,
    onFinished: () => void,
  ): LegacyExperimentalIncrementalExecutionResults {
    const { initialStreams, events } = createWorkQueue<
      ExecutionGroupValue,
      StreamItemValue,
      DeliveryGroup,
      ItemStream
    >(work);

    for (const stream of initialStreams) {
      this._indices.set(stream, stream.initialCount);
    }

    function abort(): void {
      subsequentResults.throw(abortSignal?.reason).catch(() => {
        // Ignore errors
      });
    }

    if (abortSignal) {
      abortSignal.addEventListener('abort', abort);
    }
    const onWorkQueueFinished = () => {
      onFinished();
      abortSignal?.removeEventListener('abort', abort);
    };

    const initialResult: LegacyInitialIncrementalExecutionResult = errors.length
      ? { errors, data, hasNext: true }
      : { data, hasNext: true };

    const subsequentResults = withConcurrentAbruptClose(
      mapAsyncIterable(events, (batch) =>
        this._handleBatch(batch, onWorkQueueFinished),
      ),
      () => onWorkQueueFinished(),
    );

    return {
      initialResult,
      subsequentResults,
    };
  }

  private _handleBatch(
    batch: ReadonlyArray<
      WorkQueueEvent<
        ExecutionGroupValue,
        StreamItemValue,
        DeliveryGroup,
        ItemStream
      >
    >,
    onWorkQueueFinished: (() => void) | undefined,
  ): LegacySubsequentIncrementalExecutionResult {
    const context: SubsequentIncrementalExecutionResultContext = {
      incremental: [],
      hasNext: true,
    };

    for (const event of batch) {
      this._handleWorkQueueEvent(event, context, onWorkQueueFinished);
    }

    const { incremental, hasNext } = context;

    const result: LegacySubsequentIncrementalExecutionResult = { hasNext };
    if (incremental.length > 0) {
      result.incremental = incremental;
    }

    return result;
  }

  private _handleWorkQueueEvent(
    event: WorkQueueEvent<
      ExecutionGroupValue,
      StreamItemValue,
      DeliveryGroup,
      ItemStream
    >,
    context: SubsequentIncrementalExecutionResultContext,
    onWorkQueueFinished: (() => void) | undefined,
  ): void {
    switch (event.kind) {
      case 'GROUP_VALUES': {
        const group = event.group;
        for (const value of event.values) {
          context.incremental.push(
            buildIncrementalResult(
              {
                data: value.data,
                path: pathToArray(group.path),
              },
              group.label,
              value.errors,
            ),
          );
        }
        break;
      }
      case 'GROUP_SUCCESS': {
        break;
      }
      case 'GROUP_FAILURE': {
        const group = event.group;
        context.incremental.push(
          buildIncrementalResult(
            {
              data: null,
              path: pathToArray(group.path),
            },
            group.label,
            [event.error as GraphQLError],
          ),
        );
        break;
      }
      case 'STREAM_VALUES': {
        const stream = event.stream;
        const { values } = event;
        const items: Array<unknown> = [];
        const errors: Array<GraphQLError> = [];
        for (const value of values) {
          items.push(value.item);
          if (value.errors !== undefined) {
            errors.push(...value.errors);
          }
        }
        let index = this._indices.get(stream);
        if (index === undefined) {
          index = stream.initialCount;
          this._indices.set(stream, index);
        }
        this._indices.set(stream, index + items.length);
        context.incremental.push(
          buildIncrementalResult(
            {
              items,
              path: pathToArray(addPath(stream.path, index, undefined)),
            },
            stream.label,
            errors.length > 0 ? errors : undefined,
          ),
        );
        break;
      }
      case 'STREAM_SUCCESS': {
        this._indices.delete(event.stream);
        break;
      }
      case 'STREAM_FAILURE': {
        this._indices.delete(event.stream);
        const stream = event.stream;
        context.incremental.push(
          buildIncrementalResult(
            {
              items: null,
              path: pathToArray(stream.path),
            },
            stream.label,
            [event.error as GraphQLError],
          ),
        );
        break;
      }
      case 'WORK_QUEUE_TERMINATION': {
        onWorkQueueFinished?.();
        context.hasNext = false;
        break;
      }
    }
  }
}

function buildIncrementalResult(
  originalIncrementalResult:
    | Omit<LegacyIncrementalDeferResult, 'label' | 'errors'>
    | Omit<LegacyIncrementalStreamResult, 'label' | 'errors'>,
  label: string | undefined,
  errors: ReadonlyArray<GraphQLError> | undefined,
): LegacyIncrementalResult {
  const incrementalResult: LegacyIncrementalResult = originalIncrementalResult;
  if (errors !== undefined) {
    incrementalResult.errors = errors;
  }
  if (label !== undefined) {
    incrementalResult.label = label;
  }
  return incrementalResult;
}
