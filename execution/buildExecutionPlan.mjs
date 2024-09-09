import { getBySet } from "../jsutils/getBySet.mjs";
import { isSameSet } from "../jsutils/isSameSet.mjs";
export function buildExecutionPlan(originalGroupedFieldSet, parentDeferUsages = new Set()) {
    const groupedFieldSet = new Map();
    const newGroupedFieldSets = new Map();
    for (const [responseKey, fieldGroup] of originalGroupedFieldSet) {
        const filteredDeferUsageSet = getFilteredDeferUsageSet(fieldGroup);
        if (isSameSet(filteredDeferUsageSet, parentDeferUsages)) {
            groupedFieldSet.set(responseKey, fieldGroup);
            continue;
        }
        let newGroupedFieldSet = getBySet(newGroupedFieldSets, filteredDeferUsageSet);
        if (newGroupedFieldSet === undefined) {
            newGroupedFieldSet = new Map();
            newGroupedFieldSets.set(filteredDeferUsageSet, newGroupedFieldSet);
        }
        newGroupedFieldSet.set(responseKey, fieldGroup);
    }
    return {
        groupedFieldSet,
        newGroupedFieldSets,
    };
}
function getFilteredDeferUsageSet(fieldGroup) {
    const filteredDeferUsageSet = new Set();
    for (const fieldDetails of fieldGroup) {
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
