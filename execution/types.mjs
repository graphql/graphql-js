export function isPendingExecutionGroup(incrementalDataRecord) {
    return 'deferredFragmentRecords' in incrementalDataRecord;
}
export function isCompletedExecutionGroup(incrementalDataRecordResult) {
    return 'pendingExecutionGroup' in incrementalDataRecordResult;
}
export function isFailedExecutionGroup(completedExecutionGroup) {
    return completedExecutionGroup.errors !== undefined;
}
/** @internal */
export class DeferredFragmentRecord {
    constructor(path, label, parent) {
        this.path = path;
        this.label = label;
        this.parent = parent;
        this.pendingExecutionGroups = new Set();
        this.successfulExecutionGroups = new Set();
        this.children = new Set();
    }
}
export function isDeferredFragmentRecord(deliveryGroup) {
    return deliveryGroup instanceof DeferredFragmentRecord;
}
export function isCancellableStreamRecord(deliveryGroup) {
    return 'earlyReturn' in deliveryGroup;
}
//# sourceMappingURL=types.js.map