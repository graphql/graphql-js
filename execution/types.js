'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.isReconcilableStreamItemsResult =
  exports.isCancellableStreamRecord =
  exports.DeferredFragmentRecord =
  exports.isNonReconcilableDeferredGroupedFieldSetResult =
  exports.isDeferredGroupedFieldSetResult =
  exports.isDeferredGroupedFieldSetRecord =
  exports.isDeferredFragmentRecord =
    void 0;
function isDeferredFragmentRecord(subsequentResultRecord) {
  return 'parent' in subsequentResultRecord;
}
exports.isDeferredFragmentRecord = isDeferredFragmentRecord;
function isDeferredGroupedFieldSetRecord(incrementalDataRecord) {
  return 'deferredFragmentRecords' in incrementalDataRecord;
}
exports.isDeferredGroupedFieldSetRecord = isDeferredGroupedFieldSetRecord;
function isDeferredGroupedFieldSetResult(subsequentResult) {
  return 'deferredFragmentRecords' in subsequentResult;
}
exports.isDeferredGroupedFieldSetResult = isDeferredGroupedFieldSetResult;
function isNonReconcilableDeferredGroupedFieldSetResult(
  deferredGroupedFieldSetResult,
) {
  return deferredGroupedFieldSetResult.errors !== undefined;
}
exports.isNonReconcilableDeferredGroupedFieldSetResult =
  isNonReconcilableDeferredGroupedFieldSetResult;
/** @internal */
class DeferredFragmentRecord {
  constructor(opts) {
    this.path = opts.path;
    this.label = opts.label;
    this.parent = opts.parent;
    this.expectedReconcilableResults = 0;
    this.results = [];
    this.reconcilableResults = [];
    this.children = new Set();
  }
}
exports.DeferredFragmentRecord = DeferredFragmentRecord;
function isCancellableStreamRecord(subsequentResultRecord) {
  return 'earlyReturn' in subsequentResultRecord;
}
exports.isCancellableStreamRecord = isCancellableStreamRecord;
function isReconcilableStreamItemsResult(streamItemsResult) {
  return streamItemsResult.result !== undefined;
}
exports.isReconcilableStreamItemsResult = isReconcilableStreamItemsResult;
