import type { BatchExecutor, BatchFieldGroupMap } from './types.ts';

/** @internal */
export function filterPendingBatchGroups<TPositionContext>(
  executor: BatchExecutor<TPositionContext>,
  batchFieldGroups: BatchFieldGroupMap<TPositionContext>,
): BatchFieldGroupMap<TPositionContext> {
  if (
    batchFieldGroups.size === 0 ||
    executor.collectedErrors.errors.length === 0
  ) {
    return batchFieldGroups;
  }

  const filteredBatchFieldGroups: BatchFieldGroupMap<TPositionContext> =
    new Map();
  for (const [fieldDetailsList, batchGroup] of batchFieldGroups) {
    const entries = batchGroup.entries.filter(
      (entry) => !executor.collectedErrors.hasNulledPosition(entry.path),
    );
    if (entries.length !== 0) {
      filteredBatchFieldGroups.set(fieldDetailsList, {
        ...batchGroup,
        entries,
      });
    }
  }

  return filteredBatchFieldGroups;
}
