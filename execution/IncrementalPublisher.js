'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.StreamItemsRecord =
  exports.DeferredFragmentRecord =
  exports.IncrementalPublisher =
    void 0;
const Path_js_1 = require('../jsutils/Path.js');
const promiseWithResolvers_js_1 = require('../jsutils/promiseWithResolvers.js');
/**
 * This class is used to publish incremental results to the client, enabling semi-concurrent
 * execution while preserving result order.
 *
 * The internal publishing state is managed as follows:
 *
 * '_released': the set of Incremental Data records that are ready to be sent to the client,
 * i.e. their parents have completed and they have also completed.
 *
 * `_pending`: the set of Incremental Data records that are definitely pending, i.e. their
 * parents have completed so that they can no longer be filtered. This includes all Incremental
 * Data records in `released`, as well as Incremental Data records that have not yet completed.
 *
 * @internal
 */
class IncrementalPublisher {
  constructor() {
    this._released = new Set();
    this._pending = new Set();
    this._reset();
  }
  hasNext() {
    return this._pending.size > 0;
  }
  subscribe() {
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
        if (!this.hasNext()) {
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
      const promises = [];
      this._pending.forEach((incrementalDataRecord) => {
        if (
          isStreamItemsRecord(incrementalDataRecord) &&
          incrementalDataRecord.asyncIterator?.return
        ) {
          promises.push(incrementalDataRecord.asyncIterator.return());
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
  prepareInitialResultRecord() {
    return {
      errors: [],
      children: new Set(),
    };
  }
  prepareNewDeferredFragmentRecord(opts) {
    const deferredFragmentRecord = new DeferredFragmentRecord(opts);
    const parentContext = opts.parentContext;
    parentContext.children.add(deferredFragmentRecord);
    return deferredFragmentRecord;
  }
  prepareNewStreamItemsRecord(opts) {
    const streamItemsRecord = new StreamItemsRecord(opts);
    const parentContext = opts.parentContext;
    parentContext.children.add(streamItemsRecord);
    return streamItemsRecord;
  }
  completeDeferredFragmentRecord(deferredFragmentRecord, data) {
    deferredFragmentRecord.data = data;
    deferredFragmentRecord.isCompleted = true;
    this._release(deferredFragmentRecord);
  }
  completeStreamItemsRecord(streamItemsRecord, items) {
    streamItemsRecord.items = items;
    streamItemsRecord.isCompleted = true;
    this._release(streamItemsRecord);
  }
  setIsCompletedAsyncIterator(streamItemsRecord) {
    streamItemsRecord.isCompletedAsyncIterator = true;
  }
  addFieldError(incrementalDataRecord, error) {
    incrementalDataRecord.errors.push(error);
  }
  publishInitial(initialResult) {
    for (const child of initialResult.children) {
      if (child.filtered) {
        continue;
      }
      this._publish(child);
    }
  }
  getInitialErrors(initialResult) {
    return initialResult.errors;
  }
  filter(nullPath, erroringIncrementalDataRecord) {
    const nullPathArray = (0, Path_js_1.pathToArray)(nullPath);
    const asyncIterators = new Set();
    const descendants = this._getDescendants(
      erroringIncrementalDataRecord.children,
    );
    for (const child of descendants) {
      if (!this._matchesPath(child.path, nullPathArray)) {
        continue;
      }
      child.filtered = true;
      if (isStreamItemsRecord(child)) {
        if (child.asyncIterator !== undefined) {
          asyncIterators.add(child.asyncIterator);
        }
      }
    }
    asyncIterators.forEach((asyncIterator) => {
      asyncIterator.return?.().catch(() => {
        // ignore error
      });
    });
  }
  _trigger() {
    this._resolve();
    this._reset();
  }
  _reset() {
    // promiseWithResolvers uses void only as a generic type parameter
    // see: https://typescript-eslint.io/rules/no-invalid-void-type/
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    const { promise: signalled, resolve } = (0,
    promiseWithResolvers_js_1.promiseWithResolvers)();
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
    const incrementalResults = [];
    let encounteredCompletedAsyncIterator = false;
    for (const incrementalDataRecord of completedRecords) {
      const incrementalResult = {};
      for (const child of incrementalDataRecord.children) {
        if (child.filtered) {
          continue;
        }
        this._publish(child);
      }
      if (isStreamItemsRecord(incrementalDataRecord)) {
        const items = incrementalDataRecord.items;
        if (incrementalDataRecord.isCompletedAsyncIterator) {
          // async iterable resolver just finished but there may be pending payloads
          encounteredCompletedAsyncIterator = true;
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
    return incrementalResults.length
      ? { incremental: incrementalResults, hasNext: this.hasNext() }
      : encounteredCompletedAsyncIterator && !this.hasNext()
      ? { hasNext: false }
      : undefined;
  }
  _publish(subsequentResultRecord) {
    if (subsequentResultRecord.isCompleted) {
      this._push(subsequentResultRecord);
    } else {
      this._introduce(subsequentResultRecord);
    }
  }
  _getDescendants(children, descendants = new Set()) {
    for (const child of children) {
      descendants.add(child);
      this._getDescendants(child.children, descendants);
    }
    return descendants;
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
exports.IncrementalPublisher = IncrementalPublisher;
/** @internal */
class DeferredFragmentRecord {
  constructor(opts) {
    this.label = opts.label;
    this.path = (0, Path_js_1.pathToArray)(opts.path);
    this.errors = [];
    this.children = new Set();
    this.isCompleted = false;
    this.filtered = false;
    this.data = null;
  }
}
exports.DeferredFragmentRecord = DeferredFragmentRecord;
/** @internal */
class StreamItemsRecord {
  constructor(opts) {
    this.items = null;
    this.label = opts.label;
    this.path = (0, Path_js_1.pathToArray)(opts.path);
    this.asyncIterator = opts.asyncIterator;
    this.errors = [];
    this.children = new Set();
    this.isCompleted = false;
    this.filtered = false;
    this.items = null;
  }
}
exports.StreamItemsRecord = StreamItemsRecord;
function isStreamItemsRecord(subsequentResultRecord) {
  return subsequentResultRecord instanceof StreamItemsRecord;
}
