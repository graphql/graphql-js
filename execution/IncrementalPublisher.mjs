import { invariant } from '../jsutils/invariant.mjs';
import { pathToArray } from '../jsutils/Path.mjs';
import { IncrementalGraph } from './IncrementalGraph.mjs';
import {
  isCancellableStreamRecord,
  isDeferredGroupedFieldSetResult,
  isNonReconcilableDeferredGroupedFieldSetResult,
} from './types.mjs';
export function buildIncrementalResponse(
  context,
  result,
  errors,
  incrementalDataRecords,
) {
  const incrementalPublisher = new IncrementalPublisher(context);
  return incrementalPublisher.buildResponse(
    result,
    errors,
    incrementalDataRecords,
  );
}
/**
 * This class is used to publish incremental results to the client, enabling semi-concurrent
 * execution while preserving result order.
 *
 * @internal
 */
class IncrementalPublisher {
  constructor(context) {
    this._context = context;
    this._nextId = 0;
    this._incrementalGraph = new IncrementalGraph();
  }
  buildResponse(data, errors, incrementalDataRecords) {
    this._incrementalGraph.addIncrementalDataRecords(incrementalDataRecords);
    const newPending = this._incrementalGraph.getNewPending();
    const pending = this._pendingSourcesToResults(newPending);
    const initialResult =
      errors === undefined
        ? { data, pending, hasNext: true }
        : { errors, data, pending, hasNext: true };
    return {
      initialResult,
      subsequentResults: this._subscribe(),
    };
  }
  _pendingSourcesToResults(newPending) {
    const pendingResults = [];
    for (const pendingSource of newPending) {
      const id = String(this._getNextId());
      pendingSource.id = id;
      const pendingResult = {
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
  _getNextId() {
    return String(this._nextId++);
  }
  _subscribe() {
    let isDone = false;
    const _next = async () => {
      if (isDone) {
        await this._returnAsyncIteratorsIgnoringErrors();
        return { value: undefined, done: true };
      }
      const context = {
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
          const subsequentIncrementalExecutionResult = { hasNext };
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
    const _return = async () => {
      isDone = true;
      await this._returnAsyncIterators();
      return { value: undefined, done: true };
    };
    const _throw = async (error) => {
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
  _handleCompletedIncrementalData(completedIncrementalData, context) {
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
  _handleCompletedDeferredGroupedFieldSet(
    deferredGroupedFieldSetResult,
    context,
  ) {
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
        const incrementalEntry = {
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
  _handleCompletedStreamItems(streamItemsResult, context) {
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
      const incrementalEntry = {
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
  _getBestIdAndSubPath(
    initialId,
    initialDeferredFragmentRecord,
    deferredGroupedFieldSetResult,
  ) {
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
  async _returnAsyncIterators() {
    await this._incrementalGraph.completedIncrementalData().return();
    const cancellableStreams = this._context.cancellableStreams;
    if (cancellableStreams === undefined) {
      return;
    }
    const promises = [];
    for (const streamRecord of cancellableStreams) {
      if (streamRecord.earlyReturn !== undefined) {
        promises.push(streamRecord.earlyReturn());
      }
    }
    await Promise.all(promises);
  }
  async _returnAsyncIteratorsIgnoringErrors() {
    await this._returnAsyncIterators().catch(() => {
      // Ignore errors
    });
  }
}
