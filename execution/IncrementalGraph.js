'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.IncrementalGraph = void 0;
const BoxedPromiseOrValue_js_1 = require('../jsutils/BoxedPromiseOrValue.js');
const invariant_js_1 = require('../jsutils/invariant.js');
const isPromise_js_1 = require('../jsutils/isPromise.js');
const promiseWithResolvers_js_1 = require('../jsutils/promiseWithResolvers.js');
const types_js_1 = require('./types.js');
/**
 * @internal
 */
class IncrementalGraph {
  constructor() {
    this._rootNodes = new Set();
    this._completedQueue = [];
    this._nextQueue = [];
  }
  getNewRootNodes(incrementalDataRecords) {
    const initialResultChildren = new Set();
    this._addIncrementalDataRecords(
      incrementalDataRecords,
      undefined,
      initialResultChildren,
    );
    return this._promoteNonEmptyToRoot(initialResultChildren);
  }
  addCompletedReconcilableDeferredGroupedFieldSet(reconcilableResult) {
    for (const deferredFragmentRecord of reconcilableResult
      .deferredGroupedFieldSetRecord.deferredFragmentRecords) {
      deferredFragmentRecord.deferredGroupedFieldSetRecords.delete(
        reconcilableResult.deferredGroupedFieldSetRecord,
      );
      deferredFragmentRecord.reconcilableResults.add(reconcilableResult);
    }
    const incrementalDataRecords = reconcilableResult.incrementalDataRecords;
    if (incrementalDataRecords !== undefined) {
      this._addIncrementalDataRecords(
        incrementalDataRecords,
        reconcilableResult.deferredGroupedFieldSetRecord
          .deferredFragmentRecords,
      );
    }
  }
  *currentCompletedBatch() {
    let completed;
    while ((completed = this._completedQueue.shift()) !== undefined) {
      yield completed;
    }
    if (this._rootNodes.size === 0) {
      for (const resolve of this._nextQueue) {
        resolve(undefined);
      }
    }
  }
  nextCompletedBatch() {
    const { promise, resolve } = (0,
    promiseWithResolvers_js_1.promiseWithResolvers)();
    this._nextQueue.push(resolve);
    return promise;
  }
  abort() {
    for (const resolve of this._nextQueue) {
      resolve(undefined);
    }
  }
  hasNext() {
    return this._rootNodes.size > 0;
  }
  completeDeferredFragment(deferredFragmentRecord) {
    if (
      !this._rootNodes.has(deferredFragmentRecord) ||
      deferredFragmentRecord.deferredGroupedFieldSetRecords.size > 0
    ) {
      return;
    }
    const reconcilableResults = Array.from(
      deferredFragmentRecord.reconcilableResults,
    );
    this._removeRootNode(deferredFragmentRecord);
    for (const reconcilableResult of reconcilableResults) {
      for (const otherDeferredFragmentRecord of reconcilableResult
        .deferredGroupedFieldSetRecord.deferredFragmentRecords) {
        otherDeferredFragmentRecord.reconcilableResults.delete(
          reconcilableResult,
        );
      }
    }
    const newRootNodes = this._promoteNonEmptyToRoot(
      deferredFragmentRecord.children,
    );
    return { newRootNodes, reconcilableResults };
  }
  removeDeferredFragment(deferredFragmentRecord) {
    if (!this._rootNodes.has(deferredFragmentRecord)) {
      return false;
    }
    this._removeRootNode(deferredFragmentRecord);
    return true;
  }
  removeStream(streamRecord) {
    this._removeRootNode(streamRecord);
  }
  _removeRootNode(subsequentResultRecord) {
    this._rootNodes.delete(subsequentResultRecord);
  }
  _addIncrementalDataRecords(
    incrementalDataRecords,
    parents,
    initialResultChildren,
  ) {
    for (const incrementalDataRecord of incrementalDataRecords) {
      if (
        (0, types_js_1.isDeferredGroupedFieldSetRecord)(incrementalDataRecord)
      ) {
        for (const deferredFragmentRecord of incrementalDataRecord.deferredFragmentRecords) {
          this._addDeferredFragment(
            deferredFragmentRecord,
            initialResultChildren,
          );
          deferredFragmentRecord.deferredGroupedFieldSetRecords.add(
            incrementalDataRecord,
          );
        }
        if (this._completesRootNode(incrementalDataRecord)) {
          this._onDeferredGroupedFieldSet(incrementalDataRecord);
        }
      } else if (parents === undefined) {
        initialResultChildren !== undefined ||
          (0, invariant_js_1.invariant)(false);
        initialResultChildren.add(incrementalDataRecord);
      } else {
        for (const parent of parents) {
          this._addDeferredFragment(parent, initialResultChildren);
          parent.children.add(incrementalDataRecord);
        }
      }
    }
  }
  _promoteNonEmptyToRoot(maybeEmptyNewRootNodes) {
    const newRootNodes = [];
    for (const node of maybeEmptyNewRootNodes) {
      if ((0, types_js_1.isDeferredFragmentRecord)(node)) {
        if (node.deferredGroupedFieldSetRecords.size > 0) {
          for (const deferredGroupedFieldSetRecord of node.deferredGroupedFieldSetRecords) {
            if (!this._completesRootNode(deferredGroupedFieldSetRecord)) {
              this._onDeferredGroupedFieldSet(deferredGroupedFieldSetRecord);
            }
          }
          this._rootNodes.add(node);
          newRootNodes.push(node);
          continue;
        }
        for (const child of node.children) {
          maybeEmptyNewRootNodes.add(child);
        }
      } else {
        this._rootNodes.add(node);
        newRootNodes.push(node);
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this._onStreamItems(node);
      }
    }
    return newRootNodes;
  }
  _completesRootNode(deferredGroupedFieldSetRecord) {
    return deferredGroupedFieldSetRecord.deferredFragmentRecords.some(
      (deferredFragmentRecord) => this._rootNodes.has(deferredFragmentRecord),
    );
  }
  _addDeferredFragment(deferredFragmentRecord, initialResultChildren) {
    if (this._rootNodes.has(deferredFragmentRecord)) {
      return;
    }
    const parent = deferredFragmentRecord.parent;
    if (parent === undefined) {
      initialResultChildren !== undefined ||
        (0, invariant_js_1.invariant)(false);
      initialResultChildren.add(deferredFragmentRecord);
      return;
    }
    parent.children.add(deferredFragmentRecord);
    this._addDeferredFragment(parent, initialResultChildren);
  }
  _onDeferredGroupedFieldSet(deferredGroupedFieldSetRecord) {
    let deferredGroupedFieldSetResult = deferredGroupedFieldSetRecord.result;
    if (
      !(
        deferredGroupedFieldSetResult instanceof
        BoxedPromiseOrValue_js_1.BoxedPromiseOrValue
      )
    ) {
      deferredGroupedFieldSetResult = deferredGroupedFieldSetResult();
    }
    const value = deferredGroupedFieldSetResult.value;
    if ((0, isPromise_js_1.isPromise)(value)) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      value.then((resolved) => this._enqueue(resolved));
    } else {
      this._enqueue(value);
    }
  }
  async _onStreamItems(streamRecord) {
    let items = [];
    let errors = [];
    let incrementalDataRecords = [];
    const streamItemQueue = streamRecord.streamItemQueue;
    let streamItemRecord;
    while ((streamItemRecord = streamItemQueue.shift()) !== undefined) {
      let result =
        streamItemRecord instanceof BoxedPromiseOrValue_js_1.BoxedPromiseOrValue
          ? streamItemRecord.value
          : streamItemRecord().value;
      if ((0, isPromise_js_1.isPromise)(result)) {
        if (items.length > 0) {
          this._enqueue({
            streamRecord,
            result:
              // TODO add additional test case or rework for coverage
              errors.length > 0 /* c8 ignore start */
                ? { items, errors } /* c8 ignore stop */
                : { items },
            incrementalDataRecords,
          });
          items = [];
          errors = [];
          incrementalDataRecords = [];
        }
        // eslint-disable-next-line no-await-in-loop
        result = await result;
        // wait an additional tick to coalesce resolving additional promises
        // within the queue
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
      }
      if (result.item === undefined) {
        if (items.length > 0) {
          this._enqueue({
            streamRecord,
            result: errors.length > 0 ? { items, errors } : { items },
            incrementalDataRecords,
          });
        }
        this._enqueue(
          result.errors === undefined
            ? { streamRecord }
            : {
                streamRecord,
                errors: result.errors,
              },
        );
        return;
      }
      items.push(result.item);
      if (result.errors !== undefined) {
        errors.push(...result.errors);
      }
      if (result.incrementalDataRecords !== undefined) {
        incrementalDataRecords.push(...result.incrementalDataRecords);
      }
    }
  }
  *_yieldCurrentCompletedIncrementalData(first) {
    yield first;
    yield* this.currentCompletedBatch();
  }
  _enqueue(completed) {
    const next = this._nextQueue.shift();
    if (next !== undefined) {
      next(this._yieldCurrentCompletedIncrementalData(completed));
      return;
    }
    this._completedQueue.push(completed);
  }
}
exports.IncrementalGraph = IncrementalGraph;
