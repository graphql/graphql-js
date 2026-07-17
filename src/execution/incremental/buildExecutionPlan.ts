import { isSameSet } from '../../jsutils/isSameSet.ts';
import { SetMap } from '../../jsutils/SetMap.ts';

import type {
  DeferUsage,
  FieldDetailsList,
  GroupedFieldSet,
} from '../collectFields.ts';

/** @internal */
export type DeferUsageSet = ReadonlySet<DeferUsage>;

/** @internal */
export interface ExecutionPlan {
  groupedFieldSet: GroupedFieldSet;
  newGroupedFieldSets: SetMap<DeferUsage, GroupedFieldSet>;
}

/** @internal */
export function buildExecutionPlan(
  originalGroupedFieldSet: GroupedFieldSet,
  parentDeferUsages: DeferUsageSet = new Set<DeferUsage>(),
): ExecutionPlan {
  const groupedFieldSet = new Map<string, FieldDetailsList>();
  const newGroupedFieldSets = new SetMap<
    DeferUsage,
    Map<string, FieldDetailsList>
  >();
  for (const [responseKey, fieldDetailsList] of originalGroupedFieldSet) {
    const filteredDeferUsageSet = getFilteredDeferUsageSet(fieldDetailsList);

    if (isSameSet(filteredDeferUsageSet, parentDeferUsages)) {
      groupedFieldSet.set(responseKey, fieldDetailsList);
      continue;
    }

    const newGroupedFieldSet = newGroupedFieldSets.getOrInsertComputed(
      filteredDeferUsageSet,
      () => new Map(),
    );
    newGroupedFieldSet.set(responseKey, fieldDetailsList);
  }

  return {
    groupedFieldSet,
    newGroupedFieldSets,
  };
}

function getFilteredDeferUsageSet(
  fieldDetailsList: FieldDetailsList,
): ReadonlySet<DeferUsage> {
  const filteredDeferUsageSet = new Set<DeferUsage>();
  for (const fieldDetails of fieldDetailsList) {
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
