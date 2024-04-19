import { getBySet } from '../jsutils/getBySet.mjs';
import { isSameSet } from '../jsutils/isSameSet.mjs';
export function buildFieldPlan(
  originalGroupedFieldSet,
  parentDeferUsages = new Set(),
) {
  const groupedFieldSet = new Map();
  const newGroupedFieldSets = new Map();
  const map = new Map();
  for (const [responseKey, fieldGroup] of originalGroupedFieldSet) {
    const deferUsageSet = new Set();
    let inOriginalResult = false;
    for (const fieldDetails of fieldGroup) {
      const deferUsage = fieldDetails.deferUsage;
      if (deferUsage === undefined) {
        inOriginalResult = true;
        continue;
      }
      deferUsageSet.add(deferUsage);
    }
    if (inOriginalResult) {
      deferUsageSet.clear();
    } else {
      deferUsageSet.forEach((deferUsage) => {
        const ancestors = getAncestors(deferUsage);
        for (const ancestor of ancestors) {
          if (deferUsageSet.has(ancestor)) {
            deferUsageSet.delete(deferUsage);
          }
        }
      });
    }
    map.set(responseKey, { deferUsageSet, fieldGroup });
  }
  for (const [responseKey, { deferUsageSet, fieldGroup }] of map) {
    if (isSameSet(deferUsageSet, parentDeferUsages)) {
      groupedFieldSet.set(responseKey, fieldGroup);
      continue;
    }
    let newGroupedFieldSet = getBySet(newGroupedFieldSets, deferUsageSet);
    if (newGroupedFieldSet === undefined) {
      newGroupedFieldSet = new Map();
      newGroupedFieldSets.set(deferUsageSet, newGroupedFieldSet);
    }
    newGroupedFieldSet.set(responseKey, fieldGroup);
  }
  return {
    groupedFieldSet,
    newGroupedFieldSets,
  };
}
function getAncestors(deferUsage) {
  const ancestors = [];
  let parentDeferUsage = deferUsage.parentDeferUsage;
  while (parentDeferUsage !== undefined) {
    ancestors.unshift(parentDeferUsage);
    parentDeferUsage = parentDeferUsage.parentDeferUsage;
  }
  return ancestors;
}
