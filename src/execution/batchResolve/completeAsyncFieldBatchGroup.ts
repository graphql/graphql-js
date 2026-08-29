import { isIterableObject } from '../../jsutils/isIterableObject.ts';
import { isPromise } from '../../jsutils/isPromise.ts';
import type { Path } from '../../jsutils/Path.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import { cancellablePromise } from '../cancellablePromise.ts';
import { returnIteratorCatchingErrors } from '../returnIteratorCatchingErrors.ts';

import {
  completeFieldBatchGroup,
  handleFieldBatchGroupError,
} from './completeFieldBatchGroup.ts';
import type {
  BatchExecutor,
  BatchFieldEntry,
  BatchFieldGroup,
} from './types.ts';

/** @internal */
// eslint-disable-next-line max-params
export async function completeAsyncFieldBatchGroup<TPositionContext>(
  executor: BatchExecutor<TPositionContext>,
  data: unknown,
  rootPath: Path | undefined,
  batchGroup: BatchFieldGroup<TPositionContext>,
  activeEntries: ReadonlyArray<BatchFieldEntry<TPositionContext>>,
  iterator: AsyncIterator<unknown>,
): Promise<void> {
  let completedCount = 0;
  while (true) {
    const abortSignal = executor.getAbortSignal();
    if (abortSignal?.aborted) {
      // eslint-disable-next-line no-await-in-loop
      await closeIteratorAndHandleBatchGroupAbort(
        iterator,
        executor,
        data,
        rootPath,
        batchGroup,
        activeEntries.slice(completedCount),
      );
      return;
    }

    let iteration: IteratorResult<unknown>;
    try {
      const nextResult = Promise.resolve(iterator.next());
      if (abortSignal === undefined) {
        // eslint-disable-next-line no-await-in-loop
        iteration = await nextResult;
      } else {
        // eslint-disable-next-line no-await-in-loop
        iteration = await cancellablePromise(nextResult, abortSignal);
      }
    } catch (rawError) {
      const rejectedAbortSignal = executor.getAbortSignal();
      if (rejectedAbortSignal?.aborted) {
        // eslint-disable-next-line no-await-in-loop
        await closeIteratorAndHandleBatchGroupAbort(
          iterator,
          executor,
          data,
          rootPath,
          batchGroup,
          activeEntries.slice(completedCount),
        );
        return;
      }
      // eslint-disable-next-line no-await-in-loop
      await closeIteratorAndHandleBatchGroupError(
        iterator,
        executor,
        data,
        rootPath,
        rawError,
        batchGroup,
        activeEntries,
      );
      return;
    }

    const settledAbortSignal = executor.getAbortSignal();
    if (settledAbortSignal?.aborted) {
      // eslint-disable-next-line no-await-in-loop
      await closeIteratorAndHandleBatchGroupAbort(
        iterator,
        executor,
        data,
        rootPath,
        batchGroup,
        activeEntries.slice(completedCount),
      );
      return;
    }

    let iterationDone: boolean | undefined;
    try {
      iterationDone = iteration.done;
    } catch (rawError) {
      // eslint-disable-next-line no-await-in-loop
      await closeIteratorAndHandleBatchGroupError(
        iterator,
        executor,
        data,
        rootPath,
        rawError,
        batchGroup,
        activeEntries,
      );
      return;
    }

    if (iterationDone) {
      if (completedCount !== activeEntries.length) {
        handleFieldBatchGroupError(
          executor,
          data,
          rootPath,
          createBatchResultCountError(
            batchGroup,
            activeEntries.length,
            completedCount,
          ),
          batchGroup,
          activeEntries,
        );
      }
      return;
    }

    let batchValues: Array<unknown>;
    try {
      const batchChunk = iteration.value;
      if (!isIterableObject(batchChunk)) {
        throw new GraphQLError(
          `Expected async batch resolver for field "${batchGroup.parentType}.${batchGroup.fieldDef.name}" to yield an Iterable for each result chunk.`,
        );
      }
      batchValues = Array.from(batchChunk);
    } catch (rawError) {
      // eslint-disable-next-line no-await-in-loop
      await closeIteratorAndHandleBatchGroupError(
        iterator,
        executor,
        data,
        rootPath,
        rawError,
        batchGroup,
        activeEntries,
      );
      return;
    }

    const nextCompletedCount = completedCount + batchValues.length;
    if (nextCompletedCount > activeEntries.length) {
      // eslint-disable-next-line no-await-in-loop
      await closeIteratorAndHandleBatchGroupError(
        iterator,
        executor,
        data,
        rootPath,
        createBatchResultCountError(
          batchGroup,
          activeEntries.length,
          nextCompletedCount,
        ),
        batchGroup,
        activeEntries,
      );
      return;
    }

    try {
      const completed = completeFieldBatchGroup(
        executor,
        data,
        rootPath,
        batchGroup,
        activeEntries.slice(completedCount, nextCompletedCount),
        batchValues,
      );
      if (isPromise(completed)) {
        // eslint-disable-next-line no-await-in-loop
        await completed;
      }
    } catch (error) {
      // eslint-disable-next-line no-await-in-loop
      await returnIteratorCatchingErrors(iterator);
      throw error;
    }
    completedCount = nextCompletedCount;

    const entriesToComplete = activeEntries.slice(completedCount);
    const entriesThatMustRemainActive =
      entriesToComplete.length === 0 ? activeEntries : entriesToComplete;
    if (
      entriesThatMustRemainActive.every((entry) =>
        executor.collectedErrors.hasNulledPosition(entry.path),
      )
    ) {
      // eslint-disable-next-line no-await-in-loop
      await returnIteratorCatchingErrors(iterator);
      return;
    }
  }
}

function createBatchResultCountError<TPositionContext>(
  batchGroup: BatchFieldGroup<TPositionContext>,
  expectedCount: number,
  actualCount: number,
): GraphQLError {
  return new GraphQLError(
    `Expected batch resolver for field "${batchGroup.parentType}.${batchGroup.fieldDef.name}" to return ${expectedCount} results, returned ${actualCount}.`,
  );
}

// eslint-disable-next-line max-params
async function closeIteratorAndHandleBatchGroupError<TPositionContext>(
  iterator: AsyncIterator<unknown>,
  executor: BatchExecutor<TPositionContext>,
  data: unknown,
  rootPath: Path | undefined,
  rawError: unknown,
  batchGroup: BatchFieldGroup<TPositionContext>,
  activeEntries: ReadonlyArray<BatchFieldEntry<TPositionContext>>,
): Promise<void> {
  await returnIteratorCatchingErrors(iterator);
  handleFieldBatchGroupError(
    executor,
    data,
    rootPath,
    rawError,
    batchGroup,
    activeEntries,
  );
}

// eslint-disable-next-line max-params
async function closeIteratorAndHandleBatchGroupAbort<TPositionContext>(
  iterator: AsyncIterator<unknown>,
  executor: BatchExecutor<TPositionContext>,
  data: unknown,
  rootPath: Path | undefined,
  batchGroup: BatchFieldGroup<TPositionContext>,
  batchEntries: ReadonlyArray<BatchFieldEntry<TPositionContext>>,
): Promise<void> {
  await returnIteratorCatchingErrors(iterator);
  handleFieldBatchGroupError(
    executor,
    data,
    rootPath,
    new Error('Aborted!'),
    batchGroup,
    batchEntries,
  );
}
