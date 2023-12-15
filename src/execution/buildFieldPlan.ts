import { getBySet } from '../jsutils/getBySet.js';
import { isSameSet } from '../jsutils/isSameSet.js';

import type { DeferUsage, FieldDetails } from './collectFields.js';

export const NON_DEFERRED_TARGET_SET: TargetSet = new Set<Target>([undefined]);

export type Target = DeferUsage | undefined;
export type TargetSet = ReadonlySet<Target>;
export type DeferUsageSet = ReadonlySet<DeferUsage>;

export interface FieldGroup {
  fields: ReadonlyArray<FieldDetails>;
  targets?: TargetSet | undefined;
  knownTargets?: TargetSet | undefined;
}

export type GroupedFieldSet = Map<string, FieldGroup>;

export interface NewGroupedFieldSetDetails {
  groupedFieldSet: GroupedFieldSet;
  shouldInitiateDefer: boolean;
}

export function buildFieldPlan(
  fields: Map<string, ReadonlyArray<FieldDetails>>,
  parentTargets = NON_DEFERRED_TARGET_SET,
  knownTargets = NON_DEFERRED_TARGET_SET,
): {
  groupedFieldSet: GroupedFieldSet;
  newGroupedFieldSetDetailsMap: Map<DeferUsageSet, NewGroupedFieldSetDetails>;
  newDeferUsages: ReadonlyArray<DeferUsage>;
} {
  const newDeferUsages: Set<DeferUsage> = new Set<DeferUsage>();
  const newKnownTargets = new Set<Target>(knownTargets);

  const groupedFieldSet = new Map<
    string,
    { fields: Array<FieldDetails>; targets: TargetSet; knownTargets: TargetSet }
  >();

  const newGroupedFieldSetDetailsMap = new Map<
    DeferUsageSet,
    {
      groupedFieldSet: Map<
        string,
        {
          fields: Array<FieldDetails>;
          targets: TargetSet;
          knownTargets: TargetSet;
        }
      >;
      shouldInitiateDefer: boolean;
    }
  >();

  const map = new Map<
    string,
    { targetSet: TargetSet; fieldDetailsList: ReadonlyArray<FieldDetails> }
  >();
  for (const [responseKey, fieldDetailsList] of fields) {
    const targetSet = new Set<Target>();
    for (const fieldDetails of fieldDetailsList) {
      const target = fieldDetails.deferUsage;
      targetSet.add(target);
      if (!knownTargets.has(target)) {
        // all targets that are not known must be defined
        newDeferUsages.add(target as DeferUsage);
      }
      newKnownTargets.add(target);
    }
    map.set(responseKey, { targetSet, fieldDetailsList });
  }

  for (const [responseKey, { targetSet, fieldDetailsList }] of map) {
    const maskingTargetList: Array<Target> = [];
    for (const target of targetSet) {
      if (
        target === undefined ||
        getAncestors(target).every((ancestor) => !targetSet.has(ancestor))
      ) {
        maskingTargetList.push(target);
      }
    }

    const maskingTargets: TargetSet = new Set<Target>(maskingTargetList);
    if (isSameSet(maskingTargets, parentTargets)) {
      let fieldGroup = groupedFieldSet.get(responseKey);
      if (fieldGroup === undefined) {
        fieldGroup = {
          fields: [],
          targets: maskingTargets,
          knownTargets: newKnownTargets,
        };
        groupedFieldSet.set(responseKey, fieldGroup);
      }
      fieldGroup.fields.push(...fieldDetailsList);
      continue;
    }

    let newGroupedFieldSetDetails = getBySet(
      newGroupedFieldSetDetailsMap,
      maskingTargets,
    );
    let newGroupedFieldSet;
    if (newGroupedFieldSetDetails === undefined) {
      newGroupedFieldSet = new Map<
        string,
        {
          fields: Array<FieldDetails>;
          targets: TargetSet;
          knownTargets: TargetSet;
        }
      >();

      newGroupedFieldSetDetails = {
        groupedFieldSet: newGroupedFieldSet,
        shouldInitiateDefer: maskingTargetList.some(
          (deferUsage) => !parentTargets.has(deferUsage),
        ),
      };
      newGroupedFieldSetDetailsMap.set(
        // all new grouped field sets must not contain the initial result as a target
        maskingTargets as DeferUsageSet,
        newGroupedFieldSetDetails,
      );
    } else {
      newGroupedFieldSet = newGroupedFieldSetDetails.groupedFieldSet;
    }
    let fieldGroup = newGroupedFieldSet.get(responseKey);
    if (fieldGroup === undefined) {
      fieldGroup = {
        fields: [],
        targets: maskingTargets,
        knownTargets: newKnownTargets,
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

function getAncestors(
  deferUsage: DeferUsage,
): ReadonlyArray<DeferUsage | undefined> {
  let parentDeferUsage: DeferUsage | undefined = deferUsage.parentDeferUsage;
  const ancestors: Array<DeferUsage | undefined> = [parentDeferUsage];
  while (parentDeferUsage !== undefined) {
    parentDeferUsage = parentDeferUsage.parentDeferUsage;
    ancestors.unshift(parentDeferUsage);
  }
  return ancestors;
}
