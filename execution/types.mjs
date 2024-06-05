export function isDeferredGroupedFieldSetRecord(incrementalDataRecord) {
  return 'deferredFragmentRecords' in incrementalDataRecord;
}
export function isDeferredGroupedFieldSetResult(subsequentResult) {
  return 'deferredGroupedFieldSetRecord' in subsequentResult;
}
export function isNonReconcilableDeferredGroupedFieldSetResult(
  deferredGroupedFieldSetResult,
) {
  return deferredGroupedFieldSetResult.errors !== undefined;
}
export function isCancellableStreamRecord(subsequentResultRecord) {
  return 'earlyReturn' in subsequentResultRecord;
}
export function isReconcilableStreamItemsResult(streamItemsResult) {
  return streamItemsResult.result !== undefined;
}
