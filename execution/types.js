"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeferredFragmentRecord = void 0;
exports.isPendingExecutionGroup = isPendingExecutionGroup;
exports.isCompletedExecutionGroup = isCompletedExecutionGroup;
exports.isFailedExecutionGroup = isFailedExecutionGroup;
exports.isDeferredFragmentRecord = isDeferredFragmentRecord;
exports.isCancellableStreamRecord = isCancellableStreamRecord;
function isPendingExecutionGroup(incrementalDataRecord) {
    return 'deferredFragmentRecords' in incrementalDataRecord;
}
function isCompletedExecutionGroup(incrementalDataRecordResult) {
    return 'pendingExecutionGroup' in incrementalDataRecordResult;
}
function isFailedExecutionGroup(completedExecutionGroup) {
    return completedExecutionGroup.errors !== undefined;
}
/** @internal */
class DeferredFragmentRecord {
    constructor(path, label, parent) {
        this.path = path;
        this.label = label;
        this.parent = parent;
        this.pendingExecutionGroups = new Set();
        this.successfulExecutionGroups = new Set();
        this.children = new Set();
    }
}
exports.DeferredFragmentRecord = DeferredFragmentRecord;
function isDeferredFragmentRecord(deliveryGroup) {
    return deliveryGroup instanceof DeferredFragmentRecord;
}
function isCancellableStreamRecord(deliveryGroup) {
    return 'earlyReturn' in deliveryGroup;
}
//# sourceMappingURL=types.js.map