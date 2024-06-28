'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.isCancellableStreamRecord =
  exports.isDeferredFragmentRecord =
  exports.DeferredFragmentRecord =
  exports.isNonReconcilableDeferredGroupedFieldSetResult =
  exports.isDeferredGroupedFieldSetResult =
  exports.isDeferredGroupedFieldSetRecord =
    void 0;
function isDeferredGroupedFieldSetRecord(incrementalDataRecord) {
  return 'deferredFragmentRecords' in incrementalDataRecord;
}
exports.isDeferredGroupedFieldSetRecord = isDeferredGroupedFieldSetRecord;
function isDeferredGroupedFieldSetResult(subsequentResult) {
  return 'deferredGroupedFieldSetRecord' in subsequentResult;
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
  constructor(path, label, parent) {
    this.path = path;
    this.label = label;
    this.parent = parent;
    this.deferredGroupedFieldSetRecords = new Set();
    this.reconcilableResults = new Set();
    this.children = new Set();
  }
}
exports.DeferredFragmentRecord = DeferredFragmentRecord;
function isDeferredFragmentRecord(subsequentResultRecord) {
  return subsequentResultRecord instanceof DeferredFragmentRecord;
}
exports.isDeferredFragmentRecord = isDeferredFragmentRecord;
function isCancellableStreamRecord(subsequentResultRecord) {
  return 'earlyReturn' in subsequentResultRecord;
}
exports.isCancellableStreamRecord = isCancellableStreamRecord;
