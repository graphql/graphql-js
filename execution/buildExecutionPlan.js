"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildExecutionPlan = void 0;
const getBySet_js_1 = require("../jsutils/getBySet.js");
const isSameSet_js_1 = require("../jsutils/isSameSet.js");
function buildExecutionPlan(originalGroupedFieldSet, parentDeferUsages = new Set()) {
    const groupedFieldSet = new Map();
    const newGroupedFieldSets = new Map();
    for (const [responseKey, fieldDetailsList] of originalGroupedFieldSet) {
        const filteredDeferUsageSet = getFilteredDeferUsageSet(fieldDetailsList);
        if ((0, isSameSet_js_1.isSameSet)(filteredDeferUsageSet, parentDeferUsages)) {
            groupedFieldSet.set(responseKey, fieldDetailsList);
            continue;
        }
        let newGroupedFieldSet = (0, getBySet_js_1.getBySet)(newGroupedFieldSets, filteredDeferUsageSet);
        if (newGroupedFieldSet === undefined) {
            newGroupedFieldSet = new Map();
            newGroupedFieldSets.set(filteredDeferUsageSet, newGroupedFieldSet);
        }
        newGroupedFieldSet.set(responseKey, fieldDetailsList);
    }
    return {
        groupedFieldSet,
        newGroupedFieldSets,
    };
}
exports.buildExecutionPlan = buildExecutionPlan;
function getFilteredDeferUsageSet(fieldDetailsList) {
    const filteredDeferUsageSet = new Set();
    for (const fieldDetails of fieldDetailsList) {
        const deferUsage = fieldDetails.deferUsage;
        if (deferUsage === undefined) {
            filteredDeferUsageSet.clear();
            return filteredDeferUsageSet;
        }
        filteredDeferUsageSet.add(deferUsage);
    }
    for (const deferUsage of filteredDeferUsageSet) {
        let parentDeferUsage = deferUsage.parentDeferUsage;
        while (parentDeferUsage !== undefined) {
            if (filteredDeferUsageSet.has(parentDeferUsage)) {
                filteredDeferUsageSet.delete(deferUsage);
                break;
            }
            parentDeferUsage = parentDeferUsage.parentDeferUsage;
        }
    }
    return filteredDeferUsageSet;
}
