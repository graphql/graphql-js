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
/** @internal */
export class DeferredFragmentRecord {
  constructor(path, label, parent) {
    this.path = path;
    this.label = label;
    this.parent = parent;
    this.deferredGroupedFieldSetRecords = new Set();
    this.reconcilableResults = new Set();
    this.children = new Set();
  }
}
export function isDeferredFragmentRecord(subsequentResultRecord) {
  return subsequentResultRecord instanceof DeferredFragmentRecord;
}
export function isCancellableStreamRecord(subsequentResultRecord) {
  return 'earlyReturn' in subsequentResultRecord;
}
