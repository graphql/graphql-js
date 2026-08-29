import { isPromiseLike } from '../../jsutils/isPromise.ts';
import type { ObjMap } from '../../jsutils/ObjMap.ts';
import type { Path } from '../../jsutils/Path.ts';
import { pathToArray } from '../../jsutils/Path.ts';

import type {
  GraphQLBatchResolveContext,
  MinimalTracingChannel,
} from '../../diagnostics.ts';
import {
  resolveBatchChannel,
  shouldTrace,
  traceMixed,
} from '../../diagnostics.ts';

import { getArgumentValues } from '../values.ts';

import { completeAsyncFieldBatchGroup } from './completeAsyncFieldBatchGroup.ts';
import type { BatchWorkUnit } from './completeBatchWork.ts';
import {
  completeBatchWork,
  createBatchWorkContinuation,
} from './completeBatchWork.ts';
import {
  completeFieldBatchGroup,
  handleFieldBatchGroupError,
} from './completeFieldBatchGroup.ts';
import type {
  BatchExecutor,
  BatchFieldEntry,
  BatchFieldGroup,
  BatchFieldGroupMap,
} from './types.ts';

function getBatchResolveTracingChannel():
  | MinimalTracingChannel<GraphQLBatchResolveContext>
  | undefined {
  return shouldTrace(resolveBatchChannel) ? resolveBatchChannel : undefined;
}

/** @internal */
export function executeFieldBatchResolvers<TPositionContext>(
  executor: BatchExecutor<TPositionContext>,
  data: unknown,
  rootPath: Path | undefined,
  batchFieldGroups: BatchFieldGroupMap<TPositionContext>,
): Array<Promise<void>> {
  const workUnits: Array<BatchWorkUnit> = [];
  try {
    for (const batchGroup of batchFieldGroups.values()) {
      const activeEntries = batchGroup.entries.filter(
        (entry) => !executor.collectedErrors.hasNulledPosition(entry.path),
      );
      if (activeEntries.length === 0) {
        continue;
      }
      const result = executeFieldBatchResolver(
        executor,
        data,
        rootPath,
        batchGroup,
        activeEntries,
      );
      if (result !== undefined) {
        workUnits.push(result);
      }
    }
  } catch (error) {
    if (workUnits.length !== 0) {
      executor
        .getAsyncHelpers()
        .track(workUnits.map((workUnit) => workUnit.promise));
    }
    throw error;
  }

  const completed = completeBatchWork(executor, workUnits);
  return completed === undefined ? [] : [completed];
}

function executeFieldBatchResolver<TPositionContext>(
  executor: BatchExecutor<TPositionContext>,
  data: unknown,
  rootPath: Path | undefined,
  batchGroup: BatchFieldGroup<TPositionContext>,
  activeEntries: ReadonlyArray<BatchFieldEntry<TPositionContext>>,
): BatchWorkUnit | undefined {
  let batchResult;
  try {
    const {
      schema,
      fragmentDefinitions,
      rootValue,
      operation,
      variableValues,
      hideSuggestions,
    } = executor.validatedExecutionArgs;
    const firstFieldDetails = batchGroup.fieldDetailsList[0];
    const args = getArgumentValues(
      batchGroup.fieldDef,
      firstFieldDetails.node,
      variableValues,
      firstFieldDetails.fragmentVariableValues,
      hideSuggestions,
    );
    const sources = activeEntries.map((entry) => entry.source);
    const paths = activeEntries.map((entry) => entry.path);
    const info = {
      fieldName: batchGroup.fieldDef.name,
      fieldNodes: batchGroup.fieldNodes,
      returnType: batchGroup.fieldDef.type,
      parentType: batchGroup.parentType,
      paths,
      schema,
      fragments: fragmentDefinitions,
      rootValue,
      operation,
      variableValues,
      getAbortSignal: executor.getAbortSignal,
      getAsyncHelpers: executor.getAsyncHelpers,
    };
    const resolveBatch = () =>
      batchGroup.batchResolve(
        sources,
        args,
        executor.validatedExecutionArgs.contextValue,
        info,
      );
    const tracingChannel = getBatchResolveTracingChannel();
    batchResult =
      tracingChannel === undefined
        ? resolveBatch()
        : traceMixed(
            tracingChannel,
            buildBatchResolveContext(args, batchGroup, activeEntries),
            resolveBatch,
          );
  } catch (rawError) {
    handleFieldBatchGroupError(
      executor,
      data,
      rootPath,
      rawError,
      batchGroup,
      activeEntries,
    );
    return;
  }

  if (isPromiseLike(batchResult)) {
    return createBatchWorkContinuation(
      Promise.resolve(batchResult).then(
        (resolvedBatchResult) =>
          completeFieldBatchResult(
            executor,
            data,
            rootPath,
            batchGroup,
            activeEntries,
            resolvedBatchResult,
          ),
        (rawError: unknown) => {
          handleFieldBatchGroupError(
            executor,
            data,
            rootPath,
            rawError,
            batchGroup,
            activeEntries,
          );
          return undefined;
        },
      ),
      () =>
        activeEntries.some(
          (entry) => !executor.collectedErrors.hasNulledPosition(entry.path),
        ),
    );
  }

  return completeFieldBatchResult(
    executor,
    data,
    rootPath,
    batchGroup,
    activeEntries,
    batchResult,
  );
}

/** @internal */
// eslint-disable-next-line max-params
export function completeFieldBatchResult<TPositionContext>(
  executor: BatchExecutor<TPositionContext>,
  data: unknown,
  rootPath: Path | undefined,
  batchGroup: BatchFieldGroup<TPositionContext>,
  activeEntries: ReadonlyArray<BatchFieldEntry<TPositionContext>>,
  batchResult: unknown,
): BatchWorkUnit | undefined {
  let asyncIteratorMethod: (() => AsyncIterator<unknown>) | undefined;
  try {
    asyncIteratorMethod = (
      batchResult as AsyncIterable<unknown> | null | undefined
    )?.[Symbol.asyncIterator];
  } catch (rawError) {
    handleFieldBatchGroupError(
      executor,
      data,
      rootPath,
      rawError,
      batchGroup,
      activeEntries,
    );
    return;
  }

  if (typeof asyncIteratorMethod === 'function') {
    let iterator: AsyncIterator<unknown>;
    try {
      iterator = asyncIteratorMethod.call(batchResult);
    } catch (rawError) {
      handleFieldBatchGroupError(
        executor,
        data,
        rootPath,
        rawError,
        batchGroup,
        activeEntries,
      );
      return;
    }
    return completeAsyncFieldBatchGroup(
      executor,
      data,
      rootPath,
      batchGroup,
      activeEntries,
      iterator,
    );
  }

  return completeFieldBatchGroup(
    executor,
    data,
    rootPath,
    batchGroup,
    activeEntries,
    batchResult,
  );
}

function buildBatchResolveContext<TPositionContext>(
  args: ObjMap<unknown>,
  batchGroup: BatchFieldGroup<TPositionContext>,
  activeEntries: ReadonlyArray<BatchFieldEntry<TPositionContext>>,
): Omit<GraphQLBatchResolveContext, 'error' | 'result'> {
  return {
    fieldName: batchGroup.fieldDef.name,
    responseKeys: activeEntries.map((entry) => entry.responseKey),
    parentType: batchGroup.parentType.name,
    fieldType: String(batchGroup.fieldDef.type),
    args,
    batchSize: activeEntries.length,
    fieldPaths: activeEntries.map((entry) => pathToArray(entry.path).join('.')),
  };
}
