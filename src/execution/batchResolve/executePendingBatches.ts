import { invariant } from '../../jsutils/invariant.ts';
import type { Path } from '../../jsutils/Path.ts';
import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.ts';

import { executeFieldBatchResolvers } from './executeFieldBatchResolvers.ts';
import { filterPendingBatchGroups } from './filterPendingBatchGroups.ts';
import type { BatchExecutor, BatchFieldGroupMap } from './types.ts';

/** @internal */
export function executePendingBatches<TPositionContext, TData>(
  executor: BatchExecutor<TPositionContext>,
  data: TData,
  rootPath?: Path,
): PromiseOrValue<TData> {
  if (executor.batchFieldGroups.size === 0) {
    return data;
  }

  const rootGroupedFieldSet = executor.rootGroupedFieldSet;
  invariant(
    rootGroupedFieldSet !== undefined,
    'Cannot execute pending batch fields before root fields have been collected.',
  );

  const pendingBatchGroups: Array<BatchFieldGroupMap<TPositionContext>> = [];

  // Batch completion can execute subfields that enqueue more batch records.
  const drainQueue = (): Array<Promise<void>> | undefined => {
    while (true) {
      if (executor.batchFieldGroups.size !== 0) {
        pendingBatchGroups.push(executor.batchFieldGroups);
        executor.batchFieldGroups = new Map();
      }

      const pendingBatchFieldGroups = pendingBatchGroups.shift();
      if (pendingBatchFieldGroups === undefined) {
        return;
      }

      const batchFieldGroups = filterPendingBatchGroups(
        executor,
        pendingBatchFieldGroups,
      );
      if (batchFieldGroups.size === 0) {
        continue;
      }

      const promises = executeFieldBatchResolvers(
        executor,
        data,
        rootPath,
        batchFieldGroups,
      );
      if (promises.length !== 0) {
        return promises;
      }
    }
  };

  const promises = drainQueue();
  if (promises === undefined) {
    return data;
  }

  const drainAsync = async () => {
    let batchPromises: Array<Promise<void>> | undefined = promises;
    while (batchPromises !== undefined) {
      // A later batch round must not run until all async work in the current
      // round has completed.
      // eslint-disable-next-line no-await-in-loop
      await executor.promiseAll(batchPromises);
      batchPromises = drainQueue();
    }
  };

  return drainAsync().then(() => data);
}
