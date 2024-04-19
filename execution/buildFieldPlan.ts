import { getBySet } from '../jsutils/getBySet.ts';
import { isSameSet } from '../jsutils/isSameSet.ts';
import type {
  DeferUsage,
  FieldGroup,
  GroupedFieldSet,
} from './collectFields.ts';
export type DeferUsageSet = ReadonlySet<DeferUsage>;
export interface FieldPlan {
  groupedFieldSet: GroupedFieldSet;
  newGroupedFieldSets: Map<DeferUsageSet, GroupedFieldSet>;
}
export function buildFieldPlan(
  originalGroupedFieldSet: GroupedFieldSet,
  parentDeferUsages: DeferUsageSet = new Set<DeferUsage>(),
): FieldPlan {
  const groupedFieldSet = new Map<string, FieldGroup>();
  const newGroupedFieldSets = new Map<DeferUsageSet, Map<string, FieldGroup>>();
  const map = new Map<
    string,
    {
      deferUsageSet: DeferUsageSet;
      fieldGroup: FieldGroup;
    }
  >();
  for (const [responseKey, fieldGroup] of originalGroupedFieldSet) {
    const deferUsageSet = new Set<DeferUsage>();
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
function getAncestors(deferUsage: DeferUsage): ReadonlyArray<DeferUsage> {
  const ancestors: Array<DeferUsage> = [];
  let parentDeferUsage: DeferUsage | undefined = deferUsage.parentDeferUsage;
  while (parentDeferUsage !== undefined) {
    ancestors.unshift(parentDeferUsage);
    parentDeferUsage = parentDeferUsage.parentDeferUsage;
  }
  return ancestors;
}
