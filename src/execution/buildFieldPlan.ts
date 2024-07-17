import { getBySet } from '../jsutils/getBySet.js';
import { isSameSet } from '../jsutils/isSameSet.js';

import type {
  DeferUsage,
  FieldGroup,
  GroupedFieldSet,
} from './collectFields.js';

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

  for (const [responseKey, fieldGroup] of originalGroupedFieldSet) {
    const deferUsageSet = new Set<DeferUsage>();
    for (const fieldDetails of fieldGroup) {
      const deferUsage = fieldDetails.deferUsage;
      if (deferUsage === undefined) {
        deferUsageSet.clear();
        break;
      }
      deferUsageSet.add(deferUsage);
    }

    deferUsageSet.forEach((deferUsage) => {
      const ancestors = getAncestors(deferUsage);
      for (const ancestor of ancestors) {
        if (deferUsageSet.has(ancestor)) {
          deferUsageSet.delete(deferUsage);
        }
      }
    });

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
