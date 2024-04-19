'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.buildFieldPlan = void 0;
const getBySet_js_1 = require('../jsutils/getBySet.js');
const isSameSet_js_1 = require('../jsutils/isSameSet.js');
function buildFieldPlan(
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
    if ((0, isSameSet_js_1.isSameSet)(deferUsageSet, parentDeferUsages)) {
      groupedFieldSet.set(responseKey, fieldGroup);
      continue;
    }
    let newGroupedFieldSet = (0, getBySet_js_1.getBySet)(
      newGroupedFieldSets,
      deferUsageSet,
    );
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
exports.buildFieldPlan = buildFieldPlan;
function getAncestors(deferUsage) {
  const ancestors = [];
  let parentDeferUsage = deferUsage.parentDeferUsage;
  while (parentDeferUsage !== undefined) {
    ancestors.unshift(parentDeferUsage);
    parentDeferUsage = parentDeferUsage.parentDeferUsage;
  }
  return ancestors;
}
