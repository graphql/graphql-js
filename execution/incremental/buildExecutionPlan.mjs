import { isSameSet } from "../../jsutils/isSameSet.mjs";
import { SetMap } from "../../jsutils/SetMap.mjs";
export function buildExecutionPlan(originalGroupedFieldSet, parentDeferUsages = new Set()) {
    const groupedFieldSet = new Map();
    const newGroupedFieldSets = new SetMap();
    for (const [responseKey, fieldDetailsList] of originalGroupedFieldSet) {
        const filteredDeferUsageSet = getFilteredDeferUsageSet(fieldDetailsList);
        if (isSameSet(filteredDeferUsageSet, parentDeferUsages)) {
            groupedFieldSet.set(responseKey, fieldDetailsList);
            continue;
        }
        const newGroupedFieldSet = newGroupedFieldSets.getOrInsertComputed(filteredDeferUsageSet, () => new Map());
        newGroupedFieldSet.set(responseKey, fieldDetailsList);
    }
    return {
        groupedFieldSet,
        newGroupedFieldSets,
    };
}
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
//# sourceMappingURL=buildExecutionPlan.mjs.map