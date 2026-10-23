import { memoize2 } from '../../jsutils/memoize2.ts';

import type {
  DeferUsage,
  FieldDetails,
  FieldDetailsList,
  GroupedFieldSet,
} from '../collectFields.ts';

const getInlinedGroupedFieldSet = memoize2(
  (
    groupedFieldSet: GroupedFieldSet,
    newDeferUsages: ReadonlyArray<DeferUsage>,
  ) => {
    const groupedFieldSets = new Map<number, GroupedFieldSet>();
    return (deferredCount: number): GroupedFieldSet => {
      const cached = groupedFieldSets.get(deferredCount);
      if (cached !== undefined) {
        return cached;
      }

      const inlinedDeferUsages = new Set(newDeferUsages.slice(deferredCount));
      const inlinedGroupedFieldSet = new Map<string, FieldDetailsList>();
      for (const [responseKey, fieldDetailsList] of groupedFieldSet) {
        // collectSubfields is memoized by fieldDetailsList identity. Preserve
        // unchanged lists so descendants reuse its cache across admission counts.
        let inlinedFieldDetailsList: Array<FieldDetails> | undefined;
        for (let index = 0; index < fieldDetailsList.length; index++) {
          const fieldDetails = fieldDetailsList[index];
          let deferUsage = fieldDetails.deferUsage;
          while (
            deferUsage !== undefined &&
            inlinedDeferUsages.has(deferUsage)
          ) {
            deferUsage = deferUsage.parentDeferUsage;
          }
          if (deferUsage === fieldDetails.deferUsage) {
            inlinedFieldDetailsList?.push(fieldDetails);
          } else {
            // Allocate only after finding a changed annotation; the unchanged
            // prefix can keep its original details.
            inlinedFieldDetailsList ??= fieldDetailsList.slice(0, index);
            inlinedFieldDetailsList.push({ ...fieldDetails, deferUsage });
          }
        }
        inlinedGroupedFieldSet.set(
          responseKey,
          inlinedFieldDetailsList ?? fieldDetailsList,
        );
      }

      groupedFieldSets.set(deferredCount, inlinedGroupedFieldSet);
      return inlinedGroupedFieldSet;
    };
  },
);

/**
 * Reassigns rejected defer usages to their nearest admitted ancestor before
 * planning or collecting subfields. Admission always selects a prefix of the
 * newly collected usages, so that prefix length identifies the reusable field
 * set independently of any response position or delivery group.
 *
 * @internal
 */
export function inlineDeferUsages(
  groupedFieldSet: GroupedFieldSet,
  newDeferUsages: ReadonlyArray<DeferUsage>,
  deferredCount: number,
): GroupedFieldSet {
  return deferredCount === newDeferUsages.length
    ? groupedFieldSet
    : getInlinedGroupedFieldSet(groupedFieldSet, newDeferUsages)(deferredCount);
}
