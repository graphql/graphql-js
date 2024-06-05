'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.IncrementalGraph = void 0;
const isPromise_js_1 = require('../jsutils/isPromise.js');
const promiseWithResolvers_js_1 = require('../jsutils/promiseWithResolvers.js');
const types_js_1 = require('./types.js');
function isDeferredFragmentNode(node) {
  return node !== undefined;
}
function isStreamNode(subsequentResultNode) {
  return 'path' in subsequentResultNode;
}
/**
 * @internal
 */
class IncrementalGraph {
  constructor() {
    this._pending = new Set();
    this._deferredFragmentNodes = new Map();
    this._newIncrementalDataRecords = new Set();
    this._newPending = new Set();
    this._completedQueue = [];
    this._nextQueue = [];
  }
  addIncrementalDataRecords(incrementalDataRecords) {
    for (const incrementalDataRecord of incrementalDataRecords) {
      if (
        (0, types_js_1.isDeferredGroupedFieldSetRecord)(incrementalDataRecord)
      ) {
        this._addDeferredGroupedFieldSetRecord(incrementalDataRecord);
      } else {
        this._addStreamItemsRecord(incrementalDataRecord);
      }
    }
  }
  addCompletedReconcilableDeferredGroupedFieldSet(reconcilableResult) {
    const deferredFragmentNodes =
      reconcilableResult.deferredGroupedFieldSetRecord.deferredFragmentRecords
        .map((deferredFragmentRecord) =>
          this._deferredFragmentNodes.get(deferredFragmentRecord),
        )
        .filter(isDeferredFragmentNode);
    for (const deferredFragmentNode of deferredFragmentNodes) {
      deferredFragmentNode.deferredGroupedFieldSetRecords.delete(
        reconcilableResult.deferredGroupedFieldSetRecord,
      );
      deferredFragmentNode.reconcilableResults.add(reconcilableResult);
    }
  }
  getNewPending() {
    const newPending = [];
    for (const node of this._newPending) {
      if (isStreamNode(node)) {
        this._pending.add(node);
        newPending.push(node);
      } else if (node.deferredGroupedFieldSetRecords.size > 0) {
        for (const deferredGroupedFieldSetNode of node.deferredGroupedFieldSetRecords) {
          this._newIncrementalDataRecords.add(deferredGroupedFieldSetNode);
        }
        this._pending.add(node);
        newPending.push(node.deferredFragmentRecord);
      } else {
        for (const child of node.children) {
          this._newPending.add(child);
        }
      }
    }
    this._newPending.clear();
    for (const incrementalDataRecord of this._newIncrementalDataRecords) {
      const result = incrementalDataRecord.result.value;
      if ((0, isPromise_js_1.isPromise)(result)) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        result.then((resolved) => this._enqueue(resolved));
      } else {
        this._enqueue(result);
      }
    }
    this._newIncrementalDataRecords.clear();
    return newPending;
  }
  completedIncrementalData() {
    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      next: () => {
        const firstResult = this._completedQueue.shift();
        if (firstResult !== undefined) {
          return Promise.resolve({
            value: this._yieldCurrentCompletedIncrementalData(firstResult),
            done: false,
          });
        }
        const { promise, resolve } = (0,
        promiseWithResolvers_js_1.promiseWithResolvers)();
        this._nextQueue.push(resolve);
        return promise;
      },
      return: () => {
        for (const resolve of this._nextQueue) {
          resolve({ value: undefined, done: true });
        }
        return Promise.resolve({ value: undefined, done: true });
      },
    };
  }
  hasNext() {
    return this._pending.size > 0;
  }
  completeDeferredFragment(deferredFragmentRecord) {
    const deferredFragmentNode = this._deferredFragmentNodes.get(
      deferredFragmentRecord,
    );
    // TODO: add test case?
    /* c8 ignore next 3 */
    if (deferredFragmentNode === undefined) {
      return undefined;
    }
    if (deferredFragmentNode.deferredGroupedFieldSetRecords.size > 0) {
      return;
    }
    const reconcilableResults = Array.from(
      deferredFragmentNode.reconcilableResults,
    );
    for (const reconcilableResult of reconcilableResults) {
      for (const otherDeferredFragmentRecord of reconcilableResult
        .deferredGroupedFieldSetRecord.deferredFragmentRecords) {
        const otherDeferredFragmentNode = this._deferredFragmentNodes.get(
          otherDeferredFragmentRecord,
        );
        if (otherDeferredFragmentNode === undefined) {
          continue;
        }
        otherDeferredFragmentNode.reconcilableResults.delete(
          reconcilableResult,
        );
      }
    }
    this._removePending(deferredFragmentNode);
    for (const child of deferredFragmentNode.children) {
      this._newPending.add(child);
    }
    return reconcilableResults;
  }
  removeDeferredFragment(deferredFragmentRecord) {
    const deferredFragmentNode = this._deferredFragmentNodes.get(
      deferredFragmentRecord,
    );
    if (deferredFragmentNode === undefined) {
      return false;
    }
    this._removePending(deferredFragmentNode);
    this._deferredFragmentNodes.delete(deferredFragmentRecord);
    // TODO: add test case for an erroring deferred fragment with child defers
    /* c8 ignore next 3 */
    for (const child of deferredFragmentNode.children) {
      this.removeDeferredFragment(child.deferredFragmentRecord);
    }
    return true;
  }
  removeStream(streamRecord) {
    this._removePending(streamRecord);
  }
  _removePending(subsequentResultNode) {
    this._pending.delete(subsequentResultNode);
    if (this._pending.size === 0) {
      for (const resolve of this._nextQueue) {
        resolve({ value: undefined, done: true });
      }
    }
  }
  _addDeferredGroupedFieldSetRecord(deferredGroupedFieldSetRecord) {
    for (const deferredFragmentRecord of deferredGroupedFieldSetRecord.deferredFragmentRecords) {
      const deferredFragmentNode = this._addDeferredFragmentNode(
        deferredFragmentRecord,
      );
      if (this._pending.has(deferredFragmentNode)) {
        this._newIncrementalDataRecords.add(deferredGroupedFieldSetRecord);
      }
      deferredFragmentNode.deferredGroupedFieldSetRecords.add(
        deferredGroupedFieldSetRecord,
      );
    }
  }
  _addStreamItemsRecord(streamItemsRecord) {
    const streamRecord = streamItemsRecord.streamRecord;
    if (!this._pending.has(streamRecord)) {
      this._newPending.add(streamRecord);
    }
    this._newIncrementalDataRecords.add(streamItemsRecord);
  }
  _addDeferredFragmentNode(deferredFragmentRecord) {
    let deferredFragmentNode = this._deferredFragmentNodes.get(
      deferredFragmentRecord,
    );
    if (deferredFragmentNode !== undefined) {
      return deferredFragmentNode;
    }
    deferredFragmentNode = {
      deferredFragmentRecord,
      deferredGroupedFieldSetRecords: new Set(),
      reconcilableResults: new Set(),
      children: [],
    };
    this._deferredFragmentNodes.set(
      deferredFragmentRecord,
      deferredFragmentNode,
    );
    const parent = deferredFragmentRecord.parent;
    if (parent === undefined) {
      this._newPending.add(deferredFragmentNode);
      return deferredFragmentNode;
    }
    const parentNode = this._addDeferredFragmentNode(parent);
    parentNode.children.push(deferredFragmentNode);
    return deferredFragmentNode;
  }
  *_yieldCurrentCompletedIncrementalData(first) {
    yield first;
    let completed;
    while ((completed = this._completedQueue.shift()) !== undefined) {
      yield completed;
    }
  }
  _enqueue(completed) {
    const next = this._nextQueue.shift();
    if (next !== undefined) {
      next({
        value: this._yieldCurrentCompletedIncrementalData(completed),
        done: false,
      });
      return;
    }
    this._completedQueue.push(completed);
  }
}
exports.IncrementalGraph = IncrementalGraph;
