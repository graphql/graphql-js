import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.ts';

import type { BatchExecutor } from './types.ts';

/** @internal */
export interface BatchWorkUnit {
  promise: Promise<void>;
  isActive: () => boolean;
}

/** @internal */
export function completeBatchWork<TPositionContext>(
  executor: BatchExecutor<TPositionContext>,
  workUnits: ReadonlyArray<BatchWorkUnit>,
): PromiseOrValue<void> {
  const pendingWork = new Set(workUnits);
  trackInactiveWork(executor, pendingWork);
  if (pendingWork.size === 0) {
    return;
  }
  let errorCount = executor.collectedErrors.errors.length;

  return new Promise<void>((resolve, reject) => {
    const observeWorkUnit = (workUnit: BatchWorkUnit) => {
      workUnit.promise.then(
        () => {
          if (!pendingWork.delete(workUnit)) {
            return;
          }
          const nextErrorCount = executor.collectedErrors.errors.length;
          if (nextErrorCount !== errorCount) {
            errorCount = nextErrorCount;
            trackInactiveWork(executor, pendingWork);
          }
          if (pendingWork.size === 0) {
            resolve();
          }
        },
        (error: unknown) => {
          if (!pendingWork.delete(workUnit)) {
            return;
          }
          const promises = Array.from(
            pendingWork,
            (pendingUnit) => pendingUnit.promise,
          );
          pendingWork.clear();
          executor.getAsyncHelpers().track(promises);
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          reject(error);
        },
      );
    };

    for (const workUnit of pendingWork) {
      observeWorkUnit(workUnit);
    }
  });
}

function trackInactiveWork<TPositionContext>(
  executor: BatchExecutor<TPositionContext>,
  pendingWork: Set<BatchWorkUnit>,
): void {
  const inactivePromises: Array<Promise<void>> = [];
  for (const workUnit of pendingWork) {
    if (!workUnit.isActive()) {
      pendingWork.delete(workUnit);
      inactivePromises.push(workUnit.promise);
    }
  }
  if (inactivePromises.length !== 0) {
    executor.getAsyncHelpers().track(inactivePromises);
  }
}
