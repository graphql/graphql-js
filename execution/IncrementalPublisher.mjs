import { pathToArray } from '../jsutils/Path.mjs';
import { promiseWithResolvers } from '../jsutils/promiseWithResolvers.mjs';
export function yieldSubsequentPayloads(subsequentPayloads) {
  let isDone = false;
  async function next() {
    if (isDone) {
      return { value: undefined, done: true };
    }
    await Promise.race(Array.from(subsequentPayloads).map((p) => p.promise));
    if (isDone) {
      // a different call to next has exhausted all payloads
      return { value: undefined, done: true };
    }
    const incremental = getCompletedIncrementalResults(subsequentPayloads);
    const hasNext = subsequentPayloads.size > 0;
    if (!incremental.length && hasNext) {
      return next();
    }
    if (!hasNext) {
      isDone = true;
    }
    return {
      value: incremental.length ? { incremental, hasNext } : { hasNext },
      done: false,
    };
  }
  function returnStreamIterators() {
    const promises = [];
    subsequentPayloads.forEach((incrementalDataRecord) => {
      if (
        isStreamItemsRecord(incrementalDataRecord) &&
        incrementalDataRecord.asyncIterator?.return
      ) {
        promises.push(incrementalDataRecord.asyncIterator.return());
      }
    });
    return Promise.all(promises);
  }
  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next,
    async return() {
      await returnStreamIterators();
      isDone = true;
      return { value: undefined, done: true };
    },
    async throw(error) {
      await returnStreamIterators();
      isDone = true;
      return Promise.reject(error);
    },
  };
}
function getCompletedIncrementalResults(subsequentPayloads) {
  const incrementalResults = [];
  for (const incrementalDataRecord of subsequentPayloads) {
    const incrementalResult = {};
    if (!incrementalDataRecord.isCompleted) {
      continue;
    }
    subsequentPayloads.delete(incrementalDataRecord);
    if (isStreamItemsRecord(incrementalDataRecord)) {
      const items = incrementalDataRecord.items;
      if (incrementalDataRecord.isCompletedAsyncIterator) {
        // async iterable resolver just finished but there may be pending payloads
        continue;
      }
      incrementalResult.items = items;
    } else {
      const data = incrementalDataRecord.data;
      incrementalResult.data = data ?? null;
    }
    incrementalResult.path = incrementalDataRecord.path;
    if (incrementalDataRecord.label != null) {
      incrementalResult.label = incrementalDataRecord.label;
    }
    if (incrementalDataRecord.errors.length > 0) {
      incrementalResult.errors = incrementalDataRecord.errors;
    }
    incrementalResults.push(incrementalResult);
  }
  return incrementalResults;
}
export function filterSubsequentPayloads(
  subsequentPayloads,
  nullPath,
  currentIncrementalDataRecord,
) {
  const nullPathArray = pathToArray(nullPath);
  subsequentPayloads.forEach((incrementalDataRecord) => {
    if (incrementalDataRecord === currentIncrementalDataRecord) {
      // don't remove payload from where error originates
      return;
    }
    for (let i = 0; i < nullPathArray.length; i++) {
      if (incrementalDataRecord.path[i] !== nullPathArray[i]) {
        // incrementalDataRecord points to a path unaffected by this payload
        return;
      }
    }
    // incrementalDataRecord path points to nulled error field
    if (
      isStreamItemsRecord(incrementalDataRecord) &&
      incrementalDataRecord.asyncIterator?.return
    ) {
      incrementalDataRecord.asyncIterator.return().catch(() => {
        // ignore error
      });
    }
    subsequentPayloads.delete(incrementalDataRecord);
  });
}
/** @internal */
export class DeferredFragmentRecord {
  constructor(opts) {
    this.type = 'defer';
    this.label = opts.label;
    this.path = pathToArray(opts.path);
    this.parentContext = opts.parentContext;
    this.errors = [];
    this._subsequentPayloads = opts.subsequentPayloads;
    this._subsequentPayloads.add(this);
    this.isCompleted = false;
    this.data = null;
    const { promise, resolve } = promiseWithResolvers();
    this._resolve = resolve;
    this.promise = promise.then((data) => {
      this.data = data;
      this.isCompleted = true;
    });
  }
  addData(data) {
    const parentData = this.parentContext?.promise;
    if (parentData) {
      this._resolve?.(parentData.then(() => data));
      return;
    }
    this._resolve?.(data);
  }
}
/** @internal */
export class StreamItemsRecord {
  constructor(opts) {
    this.type = 'stream';
    this.items = null;
    this.label = opts.label;
    this.path = pathToArray(opts.path);
    this.parentContext = opts.parentContext;
    this.asyncIterator = opts.asyncIterator;
    this.errors = [];
    this._subsequentPayloads = opts.subsequentPayloads;
    this._subsequentPayloads.add(this);
    this.isCompleted = false;
    this.items = null;
    const { promise, resolve } = promiseWithResolvers();
    this._resolve = resolve;
    this.promise = promise.then((items) => {
      this.items = items;
      this.isCompleted = true;
    });
  }
  addItems(items) {
    const parentData = this.parentContext?.promise;
    if (parentData) {
      this._resolve?.(parentData.then(() => items));
      return;
    }
    this._resolve?.(items);
  }
  setIsCompletedAsyncIterator() {
    this.isCompletedAsyncIterator = true;
  }
}
function isStreamItemsRecord(incrementalDataRecord) {
  return incrementalDataRecord.type === 'stream';
}
