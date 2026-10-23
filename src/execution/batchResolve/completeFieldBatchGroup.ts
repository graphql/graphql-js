import { invariant } from '../../jsutils/invariant.ts';
import { isPromise } from '../../jsutils/isPromise.ts';
import type { Path } from '../../jsutils/Path.ts';
import { pathToArray } from '../../jsutils/Path.ts';
import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.ts';

import { ensureGraphQLError } from '../../error/ensureGraphQLError.ts';
import { locatedError } from '../../error/locatedError.ts';

import type { GraphQLObjectType } from '../../type/definition.ts';
import { isObjectType } from '../../type/definition.ts';

import { buildResolveInfo } from '../buildResolveInfo.ts';

import type { BatchWorkUnit } from './completeBatchWork.ts';
import { createBatchWork } from './completeBatchWork.ts';
import { getNullablePath } from './getNullablePath.ts';
import { setPathValue } from './setPathValue.ts';
import type {
  BatchExecutor,
  BatchFieldEntry,
  BatchFieldGroup,
} from './types.ts';

/** @internal */
// eslint-disable-next-line max-params
export function completeFieldBatchGroup<TPositionContext>(
  executor: BatchExecutor<TPositionContext>,
  data: unknown,
  rootPath: Path | undefined,
  batchGroup: BatchFieldGroup<TPositionContext>,
  batchEntries: ReadonlyArray<BatchFieldEntry<TPositionContext>>,
  batchValues: ReadonlyArray<unknown>,
): BatchWorkUnit | undefined {
  const batchObjectType =
    isObjectType(batchGroup.fieldDef.type) &&
    batchGroup.fieldDef.type.isTypeOf === undefined
      ? batchGroup.fieldDef.type
      : undefined;

  const workUnits: Array<BatchWorkUnit> = [];
  try {
    for (const [i, entry] of batchEntries.entries()) {
      const result = completeFieldBatchRecord(
        executor,
        data,
        rootPath,
        batchGroup,
        batchObjectType,
        entry,
        batchValues[i],
      );
      if (isPromise(result)) {
        workUnits.push({
          promise: result,
          isActive: () =>
            !executor.collectedErrors.hasNulledPosition(entry.path),
        });
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

  return createBatchWork(executor, workUnits);
}

// eslint-disable-next-line max-params
function completeFieldBatchRecord<TPositionContext>(
  executor: BatchExecutor<TPositionContext>,
  data: unknown,
  rootPath: Path | undefined,
  batchGroup: BatchFieldGroup<TPositionContext>,
  objectType: GraphQLObjectType | undefined,
  entry: BatchFieldEntry<TPositionContext>,
  result: unknown,
): PromiseOrValue<void> {
  if (executor.collectedErrors.hasNulledPosition(entry.path)) {
    return;
  }

  const returnType = batchGroup.fieldDef.type;
  let completed;
  try {
    if (objectType !== undefined) {
      if (result == null) {
        completed = null;
      } else {
        if (result instanceof Error) {
          throw result;
        }
        completed = executor.collectAndExecuteSubfields(
          objectType,
          batchGroup.fieldDetailsList,
          entry.path,
          result,
          entry.positionContext,
        );
      }
    } else {
      const info = buildResolveInfo(
        executor.validatedExecutionArgs,
        batchGroup.fieldDef,
        batchGroup.fieldNodes,
        batchGroup.parentType,
        entry.path,
        executor.getAbortSignal,
        executor.getAsyncHelpers,
      );

      completed = executor.completeValue(
        returnType,
        batchGroup.fieldDetailsList,
        info,
        entry.path,
        result,
        entry.positionContext,
      );
    }
  } catch (rawError) {
    return handleFieldBatchRecordError(
      executor,
      data,
      rootPath,
      rawError,
      batchGroup,
      entry,
    );
  }

  if (isPromise(completed)) {
    return completed.then(
      (resolved) => {
        if (!executor.collectedErrors.hasNulledAncestor(entry.path)) {
          entry.responseTarget[entry.responseKey] = resolved;
        }
      },
      (rawError: unknown) =>
        handleFieldBatchRecordError(
          executor,
          data,
          rootPath,
          rawError,
          batchGroup,
          entry,
        ),
    );
  }

  if (!executor.collectedErrors.hasNulledAncestor(entry.path)) {
    entry.responseTarget[entry.responseKey] = completed;
  }
}

/** @internal */
// eslint-disable-next-line max-params
export function handleFieldBatchGroupError<TPositionContext>(
  executor: BatchExecutor<TPositionContext>,
  data: unknown,
  rootPath: Path | undefined,
  rawError: unknown,
  batchGroup: BatchFieldGroup<TPositionContext>,
  batchEntries: ReadonlyArray<BatchFieldEntry<TPositionContext>>,
): void {
  for (const entry of batchEntries) {
    if (executor.collectedErrors.hasNulledPosition(entry.path)) {
      continue;
    }
    handleFieldBatchRecordError(
      executor,
      data,
      rootPath,
      rawError,
      batchGroup,
      entry,
    );
  }
}

// eslint-disable-next-line max-params
function handleFieldBatchRecordError<TPositionContext>(
  executor: BatchExecutor<TPositionContext>,
  data: unknown,
  rootPath: Path | undefined,
  rawError: unknown,
  batchGroup: BatchFieldGroup<TPositionContext>,
  entry: BatchFieldEntry<TPositionContext>,
): void {
  try {
    executor.handleFieldError(
      rawError,
      batchGroup.fieldDef.type,
      batchGroup.fieldDetailsList,
      entry.path,
    );
    if (!setPathValue(data, rootPath, entry.path, null)) {
      throw locatedError(
        rawError,
        batchGroup.fieldNodes,
        pathToArray(entry.path),
      );
    }
  } catch (error) {
    const graphQLError = ensureGraphQLError(error);
    const rootGroupedFieldSet = executor.rootGroupedFieldSet;
    invariant(
      rootGroupedFieldSet !== undefined,
      'Cannot handle batch field errors before root fields have been collected.',
    );
    const nullablePath = getNullablePath(
      executor.validatedExecutionArgs,
      rootGroupedFieldSet,
      entry.path,
    );
    if (
      nullablePath !== undefined &&
      setPathValue(data, rootPath, nullablePath, null)
    ) {
      executor.collectedErrors.add(graphQLError, nullablePath);
      return;
    }

    throw graphQLError;
  }
}
