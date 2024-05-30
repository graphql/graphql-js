export function isDeferredFragmentRecord(subsequentResultRecord) {
  return 'parent' in subsequentResultRecord;
}
export function isDeferredGroupedFieldSetRecord(incrementalDataRecord) {
  return 'deferredFragmentRecords' in incrementalDataRecord;
}
export function isDeferredGroupedFieldSetResult(subsequentResult) {
  return 'deferredFragmentRecords' in subsequentResult;
}
export function isNonReconcilableDeferredGroupedFieldSetResult(
  deferredGroupedFieldSetResult,
) {
  return deferredGroupedFieldSetResult.errors !== undefined;
}
/** @internal */
export class DeferredFragmentRecord {
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
export function isCancellableStreamRecord(subsequentResultRecord) {
  return 'earlyReturn' in subsequentResultRecord;
}
export function isReconcilableStreamItemsResult(streamItemsResult) {
  return streamItemsResult.result !== undefined;
}
