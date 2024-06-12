'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.isCancellableStreamRecord =
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
function isCancellableStreamRecord(subsequentResultRecord) {
  return 'earlyReturn' in subsequentResultRecord;
}
exports.isCancellableStreamRecord = isCancellableStreamRecord;
