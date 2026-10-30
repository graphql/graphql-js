import { isIterableObject } from '../../jsutils/isIterableObject.ts';
import { isPromiseLike } from '../../jsutils/isPromise.ts';
import type { ObjMap } from '../../jsutils/ObjMap.ts';
import type { Path } from '../../jsutils/Path.ts';
import { pathToArray } from '../../jsutils/Path.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

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

import type { BatchCompletion } from './batchCompletion.ts';
import {
  batchCompletionFromPromise,
  combineBatchCompletions,
} from './batchCompletion.ts';
import { completeAsyncFieldBatchGroup } from './completeAsyncFieldBatchGroup.ts';
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
  const completions: Array<BatchCompletion> = [];
  try {
    for (const batchGroup of batchFieldGroups.values()) {
      const activeEntries = batchGroup.entries.filter(
        (entry) => !executor.collectedErrors.hasNulledPosition(entry.path),
      );
      if (activeEntries.length === 0) {
        continue;
      }
      const completion = executeFieldBatchResolver(
        executor,
        data,
        rootPath,
        batchGroup,
        activeEntries,
      );
      if (completion !== undefined) {
        completions.push(completion);
      }
    }
  } catch (error) {
    if (completions.length !== 0) {
      executor
        .getAsyncHelpers()
        .track(completions.map((completion) => completion.promise));
    }
    throw error;
  }

  const completion = combineBatchCompletions(executor, completions);
  return completion === undefined ? [] : [completion.promise];
}

function executeFieldBatchResolver<TPositionContext>(
  executor: BatchExecutor<TPositionContext>,
  data: unknown,
  rootPath: Path | undefined,
  batchGroup: BatchFieldGroup<TPositionContext>,
  activeEntries: ReadonlyArray<BatchFieldEntry<TPositionContext>>,
): BatchCompletion | undefined {
  let batchResult;
  try {
    executor.throwIfAborted();
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

    if (isPromiseLike(batchResult)) {
      const promisedCompletion = Promise.resolve(batchResult).then(
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
      );
      return batchCompletionFromPromise(promisedCompletion, () =>
        activeEntries.some(
          (entry) => !executor.collectedErrors.hasNulledPosition(entry.path),
        ),
      );
    }
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
): BatchCompletion | undefined {
  let asyncIteratorMethod: (() => AsyncIterator<unknown>) | undefined;
  let iterator!: AsyncIterator<unknown>;
  let batchValues!: Array<unknown>;
  try {
    executor.throwIfAborted();
    asyncIteratorMethod = (
      batchResult as AsyncIterable<unknown> | null | undefined
    )?.[Symbol.asyncIterator];
    if (typeof asyncIteratorMethod === 'function') {
      iterator = asyncIteratorMethod.call(batchResult);
    } else {
      if (!isIterableObject(batchResult)) {
        throw new GraphQLError(
          `Expected batch resolver for field "${batchGroup.parentType}.${batchGroup.fieldDef.name}" to return an Iterable.`,
        );
      }
      batchValues = Array.from(batchResult);
      if (batchValues.length !== activeEntries.length) {
        throw new GraphQLError(
          `Expected batch resolver for field "${batchGroup.parentType}.${batchGroup.fieldDef.name}" to return ${activeEntries.length} results, returned ${batchValues.length}.`,
        );
      }
    }
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

  // Field completion owns its errors and may propagate them past this group.
  if (typeof asyncIteratorMethod === 'function') {
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
    batchValues,
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
