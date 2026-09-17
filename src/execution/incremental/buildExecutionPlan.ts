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

/**
 * Collection of the defer usages that are still being delivered incrementally.
 * Any defer usage absent from it exceeded the configured limit and is executed
 * as if it were not deferred.
 *
 * @internal
 */
export type DeferredUsages = ReadonlyMap<DeferUsage, unknown>;

/**
 * Returns the defer usage that will actually deliver the given one, which is
 * the nearest enclosing defer usage that has not been inlined, or `undefined`
 * when the fields are delivered with the enclosing response position.
 *
 * @internal
 */
export function resolveDeferUsage(
  deferUsage: DeferUsage | undefined,
  deferredUsages: DeferredUsages | undefined,
): DeferUsage | undefined {
  if (deferredUsages === undefined) {
    return deferUsage;
  }
  let resolved = deferUsage;
  while (resolved !== undefined && !deferredUsages.has(resolved)) {
    resolved = resolved.parentDeferUsage;
  }
  return resolved;
}

/** @internal */
export function buildExecutionPlan(
  originalGroupedFieldSet: GroupedFieldSet,
  parentDeferUsages: DeferUsageSet = new Set<DeferUsage>(),
  deferredUsages?: DeferredUsages,
): ExecutionPlan {
  const groupedFieldSet = new Map<string, FieldDetailsList>();
  const newGroupedFieldSets = new SetMap<
    DeferUsage,
    Map<string, FieldDetailsList>
  >();
  for (const [responseKey, fieldDetailsList] of originalGroupedFieldSet) {
    const filteredDeferUsageSet = getFilteredDeferUsageSet(
      fieldDetailsList,
      deferredUsages,
    );

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
  deferredUsages: DeferredUsages | undefined,
): ReadonlySet<DeferUsage> {
  const filteredDeferUsageSet = new Set<DeferUsage>();
  for (const fieldDetails of fieldDetailsList) {
    const deferUsage = resolveDeferUsage(
      fieldDetails.deferUsage,
      deferredUsages,
    );
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
