import { getBySet } from '../jsutils/getBySet.mjs';
import { isSameSet } from '../jsutils/isSameSet.mjs';
export function buildFieldPlan(
  fields,
  parentDeferUsages = new Set(),
  knownDeferUsages = new Set(),
) {
  const newDeferUsages = new Set();
  const newKnownDeferUsages = new Set(knownDeferUsages);
  const groupedFieldSet = new Map();
  const newGroupedFieldSetDetailsMap = new Map();
  const map = new Map();
  for (const [responseKey, fieldDetailsList] of fields) {
    const deferUsageSet = new Set();
    let inOriginalResult = false;
    for (const fieldDetails of fieldDetailsList) {
      const deferUsage = fieldDetails.deferUsage;
      if (deferUsage === undefined) {
        inOriginalResult = true;
        continue;
      }
      deferUsageSet.add(deferUsage);
      if (!knownDeferUsages.has(deferUsage)) {
        newDeferUsages.add(deferUsage);
        newKnownDeferUsages.add(deferUsage);
      }
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
    map.set(responseKey, { deferUsageSet, fieldDetailsList });
  }
  for (const [responseKey, { deferUsageSet, fieldDetailsList }] of map) {
    if (isSameSet(deferUsageSet, parentDeferUsages)) {
      let fieldGroup = groupedFieldSet.get(responseKey);
      if (fieldGroup === undefined) {
        fieldGroup = {
          fields: [],
          deferUsages: deferUsageSet,
          knownDeferUsages: newKnownDeferUsages,
        };
        groupedFieldSet.set(responseKey, fieldGroup);
      }
      fieldGroup.fields.push(...fieldDetailsList);
      continue;
    }
    let newGroupedFieldSetDetails = getBySet(
      newGroupedFieldSetDetailsMap,
      deferUsageSet,
    );
    let newGroupedFieldSet;
    if (newGroupedFieldSetDetails === undefined) {
      newGroupedFieldSet = new Map();
      newGroupedFieldSetDetails = {
        groupedFieldSet: newGroupedFieldSet,
        shouldInitiateDefer: Array.from(deferUsageSet).some(
          (deferUsage) => !parentDeferUsages.has(deferUsage),
        ),
      };
      newGroupedFieldSetDetailsMap.set(
        deferUsageSet,
        newGroupedFieldSetDetails,
      );
    } else {
      newGroupedFieldSet = newGroupedFieldSetDetails.groupedFieldSet;
    }
    let fieldGroup = newGroupedFieldSet.get(responseKey);
    if (fieldGroup === undefined) {
      fieldGroup = {
        fields: [],
        deferUsages: deferUsageSet,
        knownDeferUsages: newKnownDeferUsages,
      };
      newGroupedFieldSet.set(responseKey, fieldGroup);
    }
    fieldGroup.fields.push(...fieldDetailsList);
  }
  return {
    groupedFieldSet,
    newGroupedFieldSetDetailsMap,
    newDeferUsages: Array.from(newDeferUsages),
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
