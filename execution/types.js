"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCancellableStreamRecord = exports.isDeferredFragmentRecord = exports.DeferredFragmentRecord = exports.isFailedExecutionGroup = exports.isCompletedExecutionGroup = exports.isPendingExecutionGroup = void 0;
function isPendingExecutionGroup(incrementalDataRecord) {
    return 'deferredFragmentRecords' in incrementalDataRecord;
}
exports.isPendingExecutionGroup = isPendingExecutionGroup;
function isCompletedExecutionGroup(incrementalDataRecordResult) {
    return 'pendingExecutionGroup' in incrementalDataRecordResult;
}
exports.isCompletedExecutionGroup = isCompletedExecutionGroup;
function isFailedExecutionGroup(completedExecutionGroup) {
    return completedExecutionGroup.errors !== undefined;
}
exports.isFailedExecutionGroup = isFailedExecutionGroup;
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
exports.isDeferredFragmentRecord = isDeferredFragmentRecord;
function isCancellableStreamRecord(deliveryGroup) {
    return 'earlyReturn' in deliveryGroup;
}
exports.isCancellableStreamRecord = isCancellableStreamRecord;
//# sourceMappingURL=types.js.map