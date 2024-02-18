import { getBySet } from '../jsutils/getBySet.js';
import { isSameSet } from '../jsutils/isSameSet.js';

import type {
  DeferUsage,
  FieldGroup,
  GroupedFieldSet,
} from './collectFields.js';

export type DeferUsageSet = ReadonlySet<DeferUsage>;

export interface NewGroupedFieldSetDetails {
  groupedFieldSet: GroupedFieldSet;
  shouldInitiateDefer: boolean;
}

export interface FieldPlan {
  groupedFieldSet: GroupedFieldSet;
  newGroupedFieldSetDetailsMap: Map<DeferUsageSet, NewGroupedFieldSetDetails>;
}

export function buildFieldPlan(
  originalGroupedFieldSet: GroupedFieldSet,
  parentDeferUsages: DeferUsageSet = new Set<DeferUsage>(),
): FieldPlan {
  const groupedFieldSet: GroupedFieldSet = new Map();

  const newGroupedFieldSetDetailsMap = new Map<
    DeferUsageSet,
    NewGroupedFieldSetDetails
  >();

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
    newGroupedFieldSet.set(responseKey, fieldGroup);
  }

  return {
    groupedFieldSet,
    newGroupedFieldSetDetailsMap,
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
