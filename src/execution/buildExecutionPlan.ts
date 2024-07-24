import { getBySet } from '../jsutils/getBySet.js';
import { isSameSet } from '../jsutils/isSameSet.js';

import type {
  DeferUsage,
  FieldGroup,
  GroupedFieldSet,
} from './collectFields.js';

export type DeferUsageSet = ReadonlySet<DeferUsage>;

export interface ExecutionPlan {
  groupedFieldSet: GroupedFieldSet;
  newGroupedFieldSets: Map<DeferUsageSet, GroupedFieldSet>;
}

export function buildExecutionPlan(
  originalGroupedFieldSet: GroupedFieldSet,
  parentDeferUsages: DeferUsageSet = new Set<DeferUsage>(),
): ExecutionPlan {
  const groupedFieldSet = new Map<string, FieldGroup>();
  const newGroupedFieldSets = new Map<DeferUsageSet, Map<string, FieldGroup>>();
  for (const [responseKey, fieldGroup] of originalGroupedFieldSet) {
    const filteredDeferUsageSet = getFilteredDeferUsageSet(fieldGroup);

    if (isSameSet(filteredDeferUsageSet, parentDeferUsages)) {
      groupedFieldSet.set(responseKey, fieldGroup);
      continue;
    }

    let newGroupedFieldSet = getBySet(
      newGroupedFieldSets,
      filteredDeferUsageSet,
    );
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

function getFilteredDeferUsageSet(
  fieldGroup: FieldGroup,
): ReadonlySet<DeferUsage> {
  const filteredDeferUsageSet = new Set<DeferUsage>();
  for (const fieldDetails of fieldGroup) {
    const deferUsage = fieldDetails.deferUsage;
    if (deferUsage === undefined) {
      filteredDeferUsageSet.clear();
      return filteredDeferUsageSet;
    }
    filteredDeferUsageSet.add(deferUsage);
  }

  for (const deferUsage of filteredDeferUsageSet) {
    let parentDeferUsage: DeferUsage | undefined = deferUsage.parentDeferUsage;
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
