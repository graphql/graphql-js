import { pathToArray } from '../jsutils/Path.mjs';
import { promiseWithResolvers } from '../jsutils/promiseWithResolvers.mjs';
/**
 * This class is used to publish incremental results to the client, enabling semi-concurrent
 * execution while preserving result order.
 *
 * The internal publishing state is managed as follows:
 *
 * '_released': the set of Subsequent Result records that are ready to be sent to the client,
 * i.e. their parents have completed and they have also completed.
 *
 * `_pending`: the set of Subsequent Result records that are definitely pending, i.e. their
 * parents have completed so that they can no longer be filtered. This includes all Subsequent
 * Result records in `released`, as well as the records that have not yet completed.
 *
 * @internal
 */
export class IncrementalPublisher {
  constructor() {
    this._nextId = 0;
    this._released = new Set();
    this._pending = new Set();
    this._reset();
  }
  reportNewDeferFragmentRecord(
    deferredFragmentRecord,
    parentIncrementalResultRecord,
  ) {
    parentIncrementalResultRecord.children.add(deferredFragmentRecord);
  }
  reportNewDeferredGroupedFieldSetRecord(deferredGroupedFieldSetRecord) {
    for (const deferredFragmentRecord of deferredGroupedFieldSetRecord.deferredFragmentRecords) {
      deferredFragmentRecord._pending.add(deferredGroupedFieldSetRecord);
      deferredFragmentRecord.deferredGroupedFieldSetRecords.add(
        deferredGroupedFieldSetRecord,
      );
    }
  }
  reportNewStreamItemsRecord(streamItemsRecord, parentIncrementalDataRecord) {
    if (isDeferredGroupedFieldSetRecord(parentIncrementalDataRecord)) {
      for (const parent of parentIncrementalDataRecord.deferredFragmentRecords) {
        parent.children.add(streamItemsRecord);
      }
    } else {
      parentIncrementalDataRecord.children.add(streamItemsRecord);
    }
  }
  completeDeferredGroupedFieldSet(deferredGroupedFieldSetRecord, data) {
    deferredGroupedFieldSetRecord.data = data;
    for (const deferredFragmentRecord of deferredGroupedFieldSetRecord.deferredFragmentRecords) {
      deferredFragmentRecord._pending.delete(deferredGroupedFieldSetRecord);
      if (deferredFragmentRecord._pending.size === 0) {
        this.completeDeferredFragmentRecord(deferredFragmentRecord);
      }
    }
  }
  markErroredDeferredGroupedFieldSet(deferredGroupedFieldSetRecord, error) {
    for (const deferredFragmentRecord of deferredGroupedFieldSetRecord.deferredFragmentRecords) {
      deferredFragmentRecord.errors.push(error);
      this.completeDeferredFragmentRecord(deferredFragmentRecord);
    }
  }
  completeDeferredFragmentRecord(deferredFragmentRecord) {
    this._release(deferredFragmentRecord);
  }
  completeStreamItemsRecord(streamItemsRecord, items) {
    streamItemsRecord.items = items;
    streamItemsRecord.isCompleted = true;
    this._release(streamItemsRecord);
  }
  markErroredStreamItemsRecord(streamItemsRecord, error) {
    streamItemsRecord.streamRecord.errors.push(error);
    this.setIsFinalRecord(streamItemsRecord);
    streamItemsRecord.isCompleted = true;
    streamItemsRecord.streamRecord.earlyReturn?.().catch(() => {
      // ignore error
    });
    this._release(streamItemsRecord);
  }
  setIsFinalRecord(streamItemsRecord) {
    streamItemsRecord.isFinalRecord = true;
  }
  setIsCompletedAsyncIterator(streamItemsRecord) {
    streamItemsRecord.isCompletedAsyncIterator = true;
    this.setIsFinalRecord(streamItemsRecord);
  }
  addFieldError(incrementalDataRecord, error) {
    incrementalDataRecord.errors.push(error);
  }
  buildDataResponse(initialResultRecord, data) {
    for (const child of initialResultRecord.children) {
      if (child.filtered) {
        continue;
      }
      this._publish(child);
    }
    const errors = initialResultRecord.errors;
    const initialResult = errors.length === 0 ? { data } : { errors, data };
    const pending = this._pending;
    if (pending.size > 0) {
      const pendingSources = new Set();
      for (const subsequentResultRecord of pending) {
        const pendingSource = isStreamItemsRecord(subsequentResultRecord)
          ? subsequentResultRecord.streamRecord
          : subsequentResultRecord;
        pendingSources.add(pendingSource);
      }
      return {
        initialResult: {
          ...initialResult,
          pending: this._pendingSourcesToResults(pendingSources),
          hasNext: true,
        },
        subsequentResults: this._subscribe(),
      };
    }
    return initialResult;
  }
  buildErrorResponse(initialResultRecord, error) {
    const errors = initialResultRecord.errors;
    errors.push(error);
    return { data: null, errors };
  }
  filter(nullPath, erroringIncrementalDataRecord) {
    const nullPathArray = pathToArray(nullPath);
    const streams = new Set();
    const children = this._getChildren(erroringIncrementalDataRecord);
    const descendants = this._getDescendants(children);
    for (const child of descendants) {
      if (!this._nullsChildSubsequentResultRecord(child, nullPathArray)) {
        continue;
      }
      child.filtered = true;
      if (isStreamItemsRecord(child)) {
        streams.add(child.streamRecord);
      }
    }
    streams.forEach((stream) => {
      stream.earlyReturn?.().catch(() => {
        // ignore error
      });
    });
  }
  _pendingSourcesToResults(pendingSources) {
    const pendingResults = [];
    for (const pendingSource of pendingSources) {
      pendingSource.pendingSent = true;
      const id = this._getNextId();
      pendingSource.id = id;
      const pendingResult = {
        id,
        path: pendingSource.path,
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
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (isDone) {
          return { value: undefined, done: true };
        }
        for (const item of this._released) {
          this._pending.delete(item);
        }
        const released = this._released;
        this._released = new Set();
        const result = this._getIncrementalResult(released);
        if (this._pending.size === 0) {
          isDone = true;
        }
        if (result !== undefined) {
          return { value: result, done: false };
        }
        // eslint-disable-next-line no-await-in-loop
        await this._signalled;
      }
    };
    const returnStreamIterators = async () => {
      const streams = new Set();
      const descendants = this._getDescendants(this._pending);
      for (const subsequentResultRecord of descendants) {
        if (isStreamItemsRecord(subsequentResultRecord)) {
          streams.add(subsequentResultRecord.streamRecord);
        }
      }
      const promises = [];
      streams.forEach((streamRecord) => {
        if (streamRecord.earlyReturn) {
          promises.push(streamRecord.earlyReturn());
        }
      });
      await Promise.all(promises);
    };
    const _return = async () => {
      isDone = true;
      await returnStreamIterators();
      return { value: undefined, done: true };
    };
    const _throw = async (error) => {
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
  _trigger() {
    this._resolve();
    this._reset();
  }
  _reset() {
    // promiseWithResolvers uses void only as a generic type parameter
    // see: https://typescript-eslint.io/rules/no-invalid-void-type/
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    const { promise: signalled, resolve } = promiseWithResolvers();
    this._resolve = resolve;
    this._signalled = signalled;
  }
  _introduce(item) {
    this._pending.add(item);
  }
  _release(item) {
    if (this._pending.has(item)) {
      this._released.add(item);
      this._trigger();
    }
  }
  _push(item) {
    this._released.add(item);
    this._pending.add(item);
    this._trigger();
  }
  _getIncrementalResult(completedRecords) {
    const { pending, incremental, completed } =
      this._processPending(completedRecords);
    const hasNext = this._pending.size > 0;
    if (incremental.length === 0 && completed.length === 0 && hasNext) {
      return undefined;
    }
    const result = { hasNext };
    if (pending.length) {
      result.pending = pending;
    }
    if (incremental.length) {
      result.incremental = incremental;
    }
    if (completed.length) {
      result.completed = completed;
    }
    return result;
  }
  _processPending(completedRecords) {
    const newPendingSources = new Set();
    const incrementalResults = [];
    const completedResults = [];
    for (const subsequentResultRecord of completedRecords) {
      for (const child of subsequentResultRecord.children) {
        if (child.filtered) {
          continue;
        }
        const pendingSource = isStreamItemsRecord(child)
          ? child.streamRecord
          : child;
        if (!pendingSource.pendingSent) {
          newPendingSources.add(pendingSource);
        }
        this._publish(child);
      }
      if (isStreamItemsRecord(subsequentResultRecord)) {
        if (subsequentResultRecord.isFinalRecord) {
          newPendingSources.delete(subsequentResultRecord.streamRecord);
          completedResults.push(
            this._completedRecordToResult(subsequentResultRecord.streamRecord),
          );
        }
        if (subsequentResultRecord.isCompletedAsyncIterator) {
          // async iterable resolver just finished but there may be pending payloads
          continue;
        }
        if (subsequentResultRecord.streamRecord.errors.length > 0) {
          continue;
        }
        const incrementalResult = {
          // safe because `items` is always defined when the record is completed
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          items: subsequentResultRecord.items,
          // safe because `id` is defined once the stream has been released as pending
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          id: subsequentResultRecord.streamRecord.id,
        };
        if (subsequentResultRecord.errors.length > 0) {
          incrementalResult.errors = subsequentResultRecord.errors;
        }
        incrementalResults.push(incrementalResult);
      } else {
        newPendingSources.delete(subsequentResultRecord);
        completedResults.push(
          this._completedRecordToResult(subsequentResultRecord),
        );
        if (subsequentResultRecord.errors.length > 0) {
          continue;
        }
        for (const deferredGroupedFieldSetRecord of subsequentResultRecord.deferredGroupedFieldSetRecords) {
          if (!deferredGroupedFieldSetRecord.sent) {
            deferredGroupedFieldSetRecord.sent = true;
            const incrementalResult = this._getIncrementalDeferResult(
              deferredGroupedFieldSetRecord,
            );
            if (deferredGroupedFieldSetRecord.errors.length > 0) {
              incrementalResult.errors = deferredGroupedFieldSetRecord.errors;
            }
            incrementalResults.push(incrementalResult);
          }
        }
      }
    }
    return {
      pending: this._pendingSourcesToResults(newPendingSources),
      incremental: incrementalResults,
      completed: completedResults,
    };
  }
  _getIncrementalDeferResult(deferredGroupedFieldSetRecord) {
    const { data, deferredFragmentRecords } = deferredGroupedFieldSetRecord;
    let maxLength;
    let idWithLongestPath;
    for (const deferredFragmentRecord of deferredFragmentRecords) {
      const id = deferredFragmentRecord.id;
      if (id === undefined) {
        continue;
      }
      const length = deferredFragmentRecord.path.length;
      if (maxLength === undefined || length > maxLength) {
        maxLength = length;
        idWithLongestPath = id;
      }
    }
    const subPath = deferredGroupedFieldSetRecord.path.slice(maxLength);
    const incrementalDeferResult = {
      // safe because `data``is always defined when the record is completed
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      data: data,
      // safe because `id` is always defined once the fragment has been released
      // as pending and at least one fragment has been completed, so must have been
      // released as pending
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      id: idWithLongestPath,
    };
    if (subPath.length > 0) {
      incrementalDeferResult.subPath = subPath;
    }
    return incrementalDeferResult;
  }
  _completedRecordToResult(completedRecord) {
    const result = {
      // safe because `id` is defined once the stream has been released as pending
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      id: completedRecord.id,
    };
    if (completedRecord.errors.length > 0) {
      result.errors = completedRecord.errors;
    }
    return result;
  }
  _publish(subsequentResultRecord) {
    if (isStreamItemsRecord(subsequentResultRecord)) {
      if (subsequentResultRecord.isCompleted) {
        this._push(subsequentResultRecord);
        return;
      }
      this._introduce(subsequentResultRecord);
      return;
    }
    if (subsequentResultRecord._pending.size > 0) {
      this._introduce(subsequentResultRecord);
    } else if (
      subsequentResultRecord.deferredGroupedFieldSetRecords.size > 0 ||
      subsequentResultRecord.children.size > 0
    ) {
      this._push(subsequentResultRecord);
    }
  }
  _getChildren(erroringIncrementalDataRecord) {
    const children = new Set();
    if (isDeferredGroupedFieldSetRecord(erroringIncrementalDataRecord)) {
      for (const erroringIncrementalResultRecord of erroringIncrementalDataRecord.deferredFragmentRecords) {
        for (const child of erroringIncrementalResultRecord.children) {
          children.add(child);
        }
      }
    } else {
      for (const child of erroringIncrementalDataRecord.children) {
        children.add(child);
      }
    }
    return children;
  }
  _getDescendants(children, descendants = new Set()) {
    for (const child of children) {
      descendants.add(child);
      this._getDescendants(child.children, descendants);
    }
    return descendants;
  }
  _nullsChildSubsequentResultRecord(subsequentResultRecord, nullPath) {
    const incrementalDataRecords = isStreamItemsRecord(subsequentResultRecord)
      ? [subsequentResultRecord]
      : subsequentResultRecord.deferredGroupedFieldSetRecords;
    for (const incrementalDataRecord of incrementalDataRecords) {
      if (this._matchesPath(incrementalDataRecord.path, nullPath)) {
        return true;
      }
    }
    return false;
  }
  _matchesPath(testPath, basePath) {
    for (let i = 0; i < basePath.length; i++) {
      if (basePath[i] !== testPath[i]) {
        // testPath points to a path unaffected at basePath
        return false;
      }
    }
    return true;
  }
}
function isDeferredGroupedFieldSetRecord(incrementalDataRecord) {
  return incrementalDataRecord instanceof DeferredGroupedFieldSetRecord;
}
function isStreamItemsRecord(subsequentResultRecord) {
  return subsequentResultRecord instanceof StreamItemsRecord;
}
/** @internal */
export class InitialResultRecord {
  constructor() {
    this.errors = [];
    this.children = new Set();
  }
}
/** @internal */
export class DeferredGroupedFieldSetRecord {
  constructor(opts) {
    this.path = pathToArray(opts.path);
    this.deferredFragmentRecords = opts.deferredFragmentRecords;
    this.groupedFieldSet = opts.groupedFieldSet;
    this.shouldInitiateDefer = opts.shouldInitiateDefer;
    this.errors = [];
    this.sent = false;
  }
}
/** @internal */
export class DeferredFragmentRecord {
  constructor(opts) {
    this.path = pathToArray(opts.path);
    this.label = opts.label;
    this.children = new Set();
    this.filtered = false;
    this.deferredGroupedFieldSetRecords = new Set();
    this.errors = [];
    this._pending = new Set();
  }
}
/** @internal */
export class StreamRecord {
  constructor(opts) {
    this.label = opts.label;
    this.path = pathToArray(opts.path);
    this.errors = [];
    this.earlyReturn = opts.earlyReturn;
  }
}
/** @internal */
export class StreamItemsRecord {
  constructor(opts) {
    this.streamRecord = opts.streamRecord;
    this.path = pathToArray(opts.path);
    this.children = new Set();
    this.errors = [];
    this.isCompleted = false;
    this.filtered = false;
  }
}
