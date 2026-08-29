import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.ts';

import type { BatchExecutor } from './types.ts';

/** @internal */
export interface BatchWorkUnit {
  promise: Promise<void>;
  isActive: () => boolean;
  // Refresh nested work before checking whether this unit remains active.
  refresh?: () => void;
}

/** @internal */
export function createBatchWork<TPositionContext>(
  executor: BatchExecutor<TPositionContext>,
  workUnits: ReadonlyArray<BatchWorkUnit>,
): BatchWorkUnit | undefined {
  const pendingWork = new Set(workUnits);
  trackInactiveWork(executor, pendingWork);
  if (pendingWork.size === 0) {
    return;
  }
  let errorCount = executor.collectedErrors.errors.length;
  let settled = false;
  let rejected = false;
  let resolveWork!: () => void;
  let rejectWork!: (error: unknown) => void;

  const promise = new Promise<void>((resolve, reject) => {
    resolveWork = resolve;
    rejectWork = reject;
  });

  const settleIfComplete = () => {
    if (!settled && pendingWork.size === 0) {
      settled = true;
      resolveWork();
    }
  };

  const refresh = () => {
    trackInactiveWork(executor, pendingWork);
    settleIfComplete();
  };

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
        settleIfComplete();
      },
      (error: unknown) => {
        if (!pendingWork.delete(workUnit)) {
          return;
        }
        settled = true;
        rejected = true;
        const promises = Array.from(
          pendingWork,
          (pendingUnit) => pendingUnit.promise,
        );
        pendingWork.clear();
        executor.getAsyncHelpers().track(promises);
        rejectWork(error);
      },
    );
  };

  for (const workUnit of pendingWork) {
    observeWorkUnit(workUnit);
  }

  return {
    promise,
    isActive: () => rejected || pendingWork.size !== 0,
    refresh,
  };
}

/** @internal */
export function createBatchWorkContinuation(
  continuation: Promise<BatchWorkUnit | undefined>,
  isActiveBeforeContinuation: () => boolean,
): BatchWorkUnit {
  let continuedWork: BatchWorkUnit | undefined;
  let continuationPending = true;
  let rejected = false;
  const promise = continuation.then(
    (workUnit) => {
      continuationPending = false;
      continuedWork = workUnit;
      return workUnit?.promise;
    },
    (error: unknown) => {
      continuationPending = false;
      rejected = true;
      throw error;
    },
  );

  return {
    promise,
    refresh: () => continuedWork?.refresh?.(),
    isActive: () =>
      rejected ||
      (continuedWork?.isActive() ??
        (continuationPending && isActiveBeforeContinuation())),
  };
}

/** @internal */
export function completeBatchWork<TPositionContext>(
  executor: BatchExecutor<TPositionContext>,
  workUnits: ReadonlyArray<BatchWorkUnit>,
): PromiseOrValue<void> {
  return createBatchWork(executor, workUnits)?.promise;
}

function trackInactiveWork<TPositionContext>(
  executor: BatchExecutor<TPositionContext>,
  pendingWork: Set<BatchWorkUnit>,
): void {
  const inactivePromises: Array<Promise<void>> = [];
  for (const workUnit of pendingWork) {
    workUnit.refresh?.();
    if (!workUnit.isActive()) {
      pendingWork.delete(workUnit);
      inactivePromises.push(workUnit.promise);
    }
  }
  if (inactivePromises.length !== 0) {
    executor.getAsyncHelpers().track(inactivePromises);
  }
}
