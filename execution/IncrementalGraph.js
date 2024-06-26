'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.IncrementalGraph = void 0;
const BoxedPromiseOrValue_js_1 = require('../jsutils/BoxedPromiseOrValue.js');
const invariant_js_1 = require('../jsutils/invariant.js');
const isPromise_js_1 = require('../jsutils/isPromise.js');
const promiseWithResolvers_js_1 = require('../jsutils/promiseWithResolvers.js');
const types_js_1 = require('./types.js');
function isDeferredFragmentNode(node) {
  return node !== undefined && 'deferredFragmentRecord' in node;
}
/**
 * @internal
 */
class IncrementalGraph {
  constructor() {
    this._rootNodes = new Set();
    this._deferredFragmentNodes = new Map();
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
    for (const deferredFragmentNode of this._fragmentsToNodes(
      reconcilableResult.deferredGroupedFieldSetRecord.deferredFragmentRecords,
    )) {
      deferredFragmentNode.deferredGroupedFieldSetRecords.delete(
        reconcilableResult.deferredGroupedFieldSetRecord,
      );
      deferredFragmentNode.reconcilableResults.add(reconcilableResult);
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
    return this._rootNodes.size > 0;
  }
  completeDeferredFragment(deferredFragmentRecord) {
    const deferredFragmentNode = this._deferredFragmentNodes.get(
      deferredFragmentRecord,
    );
    // TODO: add test case?
    /* c8 ignore next 3 */
    if (deferredFragmentNode === undefined) {
      return;
    }
    if (deferredFragmentNode.deferredGroupedFieldSetRecords.size > 0) {
      return;
    }
    const reconcilableResults = Array.from(
      deferredFragmentNode.reconcilableResults,
    );
    this._removeRootNode(deferredFragmentNode);
    for (const reconcilableResult of reconcilableResults) {
      for (const otherDeferredFragmentNode of this._fragmentsToNodes(
        reconcilableResult.deferredGroupedFieldSetRecord
          .deferredFragmentRecords,
      )) {
        otherDeferredFragmentNode.reconcilableResults.delete(
          reconcilableResult,
        );
      }
    }
    const newRootNodes = this._promoteNonEmptyToRoot(
      deferredFragmentNode.children,
    );
    return { newRootNodes, reconcilableResults };
  }
  removeDeferredFragment(deferredFragmentRecord) {
    const deferredFragmentNode = this._deferredFragmentNodes.get(
      deferredFragmentRecord,
    );
    if (deferredFragmentNode === undefined) {
      return false;
    }
    this._removeRootNode(deferredFragmentNode);
    this._deferredFragmentNodes.delete(deferredFragmentRecord);
    // TODO: add test case for an erroring deferred fragment with child defers
    /* c8 ignore next 5 */
    for (const child of deferredFragmentNode.children) {
      if (isDeferredFragmentNode(child)) {
        this.removeDeferredFragment(child.deferredFragmentRecord);
      }
    }
    return true;
  }
  removeStream(streamRecord) {
    this._removeRootNode(streamRecord);
  }
  _removeRootNode(subsequentResultNode) {
    this._rootNodes.delete(subsequentResultNode);
    if (this._rootNodes.size === 0) {
      for (const resolve of this._nextQueue) {
        resolve({ value: undefined, done: true });
      }
    }
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
          const deferredFragmentNode = this._addDeferredFragmentNode(
            deferredFragmentRecord,
            initialResultChildren,
          );
          deferredFragmentNode.deferredGroupedFieldSetRecords.add(
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
          const deferredFragmentNode = this._addDeferredFragmentNode(
            parent,
            initialResultChildren,
          );
          deferredFragmentNode.children.add(incrementalDataRecord);
        }
      }
    }
  }
  _promoteNonEmptyToRoot(maybeEmptyNewRootNodes) {
    const newRootNodes = [];
    for (const node of maybeEmptyNewRootNodes) {
      if (isDeferredFragmentNode(node)) {
        if (node.deferredGroupedFieldSetRecords.size > 0) {
          for (const deferredGroupedFieldSetRecord of node.deferredGroupedFieldSetRecords) {
            if (!this._completesRootNode(deferredGroupedFieldSetRecord)) {
              this._onDeferredGroupedFieldSet(deferredGroupedFieldSetRecord);
            }
          }
          this._rootNodes.add(node);
          newRootNodes.push(node.deferredFragmentRecord);
          continue;
        }
        this._deferredFragmentNodes.delete(node.deferredFragmentRecord);
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
    return this._fragmentsToNodes(
      deferredGroupedFieldSetRecord.deferredFragmentRecords,
    ).some((node) => this._rootNodes.has(node));
  }
  _fragmentsToNodes(deferredFragmentRecords) {
    return deferredFragmentRecords
      .map((deferredFragmentRecord) =>
        this._deferredFragmentNodes.get(deferredFragmentRecord),
      )
      .filter(isDeferredFragmentNode);
  }
  _addDeferredFragmentNode(deferredFragmentRecord, initialResultChildren) {
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
      children: new Set(),
    };
    this._deferredFragmentNodes.set(
      deferredFragmentRecord,
      deferredFragmentNode,
    );
    const parent = deferredFragmentRecord.parent;
    if (parent === undefined) {
      initialResultChildren !== undefined ||
        (0, invariant_js_1.invariant)(false);
      initialResultChildren.add(deferredFragmentNode);
      return deferredFragmentNode;
    }
    const parentNode = this._addDeferredFragmentNode(
      parent,
      initialResultChildren,
    );
    parentNode.children.add(deferredFragmentNode);
    return deferredFragmentNode;
  }
  _onDeferredGroupedFieldSet(deferredGroupedFieldSetRecord) {
    const deferredGroupedFieldSetResult = deferredGroupedFieldSetRecord.result;
    const result =
      deferredGroupedFieldSetResult instanceof
      BoxedPromiseOrValue_js_1.BoxedPromiseOrValue
        ? deferredGroupedFieldSetResult.value
        : deferredGroupedFieldSetResult().value;
    if ((0, isPromise_js_1.isPromise)(result)) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      result.then((resolved) => this._enqueue(resolved));
    } else {
      this._enqueue(result);
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
