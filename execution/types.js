'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.isReconcilableStreamItemsResult =
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
function isReconcilableStreamItemsResult(streamItemsResult) {
  return streamItemsResult.result !== undefined;
}
exports.isReconcilableStreamItemsResult = isReconcilableStreamItemsResult;
