import { invariant } from '../jsutils/invariant.js';
import { isObjectLike } from '../jsutils/isObjectLike.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path } from '../jsutils/Path.js';
import { addPath, pathToArray } from '../jsutils/Path.js';

import type { GraphQLError } from '../error/GraphQLError.js';

import type { SelectionSetNode } from '../language/ast.js';

import type { GraphQLObjectType } from '../type/definition.js';
import { isObjectType } from '../type/definition.js';

import { mapAsyncIterable } from '../execution/mapAsyncIterable.js';
import type {
  CompletedResult,
  ExecutionResult,
  ExperimentalIncrementalExecutionResults,
  IncrementalResult,
  InitialIncrementalExecutionResult,
  PendingResult,
  SubsequentIncrementalExecutionResult,
} from '../execution/types.js';

import type { TransformationContext } from './buildTransformationContext.js';
import { collectFields as _collectFields } from './collectFields.js';
import { completeSubValue, completeValue } from './completeValue.js';
import { embedErrors } from './embedErrors.js';
import { getObjectAtPath } from './getObjectAtPath.js';
import { memoize3of4 } from './memoize3of4.js';

export interface LegacyExperimentalIncrementalExecutionResults {
  initialResult: LegacyInitialIncrementalExecutionResult;
  subsequentResults: AsyncGenerator<
    LegacySubsequentIncrementalExecutionResult,
    void,
    void
  >;
}

export interface LegacyInitialIncrementalExecutionResult
  extends ExecutionResult {
  data: ObjMap<unknown>;
  hasNext: true;
}

export interface LegacySubsequentIncrementalExecutionResult {
  incremental?: ReadonlyArray<LegacyIncrementalResult>;
  hasNext: boolean;
}

interface LegacyIncrementalDeferResult extends ExecutionResult {
  path: ReadonlyArray<string | number>;
  label?: string;
}

interface LegacyIncrementalStreamResult {
  items: ReadonlyArray<unknown> | null;
  errors?: ReadonlyArray<GraphQLError>;
  path: ReadonlyArray<string | number>;
  label?: string;
}

type LegacyIncrementalResult =
  | LegacyIncrementalDeferResult
  | LegacyIncrementalStreamResult;

const collectFields = memoize3of4(
  (
    context: TransformationContext,
    returnType: GraphQLObjectType,
    selectionSet: SelectionSetNode,
    path: Path | undefined,
  ) => _collectFields(context, returnType, selectionSet, path),
);

export function transformResult(
  context: TransformationContext,
  result: ExecutionResult | ExperimentalIncrementalExecutionResults,
): ExecutionResult | LegacyExperimentalIncrementalExecutionResults {
  if ('initialResult' in result) {
    const initialResult = transformInitialResult(context, result.initialResult);

    return {
      initialResult,
      subsequentResults: mapAsyncIterable(
        result.subsequentResults,
        (subsequentResult) => transformSubsequent(context, subsequentResult),
      ),
    };
  }
  return transformInitialResult(context, result);
}

function transformSubsequent(
  context: TransformationContext,
  result: SubsequentIncrementalExecutionResult,
): LegacySubsequentIncrementalExecutionResult {
  const newResult: LegacySubsequentIncrementalExecutionResult = {
    hasNext: result.hasNext,
  };
  if (result.pending) {
    processPending(context, result.pending);
  }

  if (result.incremental) {
    const incremental = processIncremental(context, result.incremental);
    if (incremental.length > 0) {
      newResult.incremental = incremental;
    }
  }

  if (result.completed) {
    const incremental = processCompleted(context, result.completed);
    if (incremental.length > 0) {
      if (newResult.incremental) {
        newResult.incremental = [...newResult.incremental, ...incremental];
      } else {
        newResult.incremental = incremental;
      }
    }
  }

  return newResult;
}

function processPending(
  context: TransformationContext,
  pendingResults: ReadonlyArray<PendingResult>,
): void {
  for (const pendingResult of pendingResults) {
    context.pendingResultsById.set(pendingResult.id, pendingResult);
    const path = pendingResult.path;
    const pathStr = path.join('.');
    let labels = context.pendingLabelsByPath.get(pathStr);
    if (!labels) {
      labels = new Set();
      context.pendingLabelsByPath.set(pathStr, labels);
    }
    invariant(pendingResult.label != null);
    labels.add(pendingResult.label);
  }
}

function processIncremental(
  context: TransformationContext,
  incrementalResults: ReadonlyArray<IncrementalResult>,
): ReadonlyArray<LegacyIncrementalStreamResult> {
  const streamLabels = new Set<string>();
  for (const incrementalResult of incrementalResults) {
    const id = incrementalResult.id;
    const pendingResult = context.pendingResultsById.get(id);
    invariant(pendingResult != null);
    const path = incrementalResult.subPath
      ? [...pendingResult.path, ...incrementalResult.subPath]
      : pendingResult.path;

    const incompleteAtPath = getObjectAtPath(context.mergedResult, path);
    if (Array.isArray(incompleteAtPath)) {
      invariant('items' in incrementalResult);
      const items = incrementalResult.items as ReadonlyArray<unknown>;
      const errors = incrementalResult.errors;
      incompleteAtPath.push(...items);
      embedErrors(context.mergedResult, errors);
      const label = pendingResult.label;
      invariant(label != null);
      streamLabels.add(label);
    } else {
      invariant('data' in incrementalResult);
      for (const [key, value] of Object.entries(
        incrementalResult.data as ObjMap<unknown>,
      )) {
        incompleteAtPath[key] = value;
      }
      embedErrors(context.mergedResult, incrementalResult.errors);
    }
  }

  const incremental: Array<LegacyIncrementalStreamResult> = [];
  for (const label of streamLabels) {
    const streamUsageContext = context.streamUsageMap.get(label);
    invariant(streamUsageContext != null);
    const { originalLabel, nextIndex, streams } = streamUsageContext;
    for (const stream of streams) {
      const { path, itemType, fieldDetailsList } = stream;
      const list = getObjectAtPath(context.mergedResult, pathToArray(path));
      invariant(Array.isArray(list));
      const items: Array<unknown> = [];
      const errors: Array<GraphQLError> = [];
      for (let i = nextIndex; i < list.length; i++) {
        const item = completeSubValue(
          context,
          errors,
          itemType,
          fieldDetailsList,
          list[i],
          addPath(path, i, undefined),
          1,
        );
        items.push(item);
      }
      streamUsageContext.nextIndex = list.length;
      const newIncrementalResult: LegacyIncrementalStreamResult = {
        items,
        path: [...pathToArray(path), nextIndex],
      };
      if (errors.length > 0) {
        newIncrementalResult.errors = errors;
      }
      if (originalLabel != null) {
        newIncrementalResult.label = originalLabel;
      }
      incremental.push(newIncrementalResult);
    }
  }
  return incremental;
}

function processCompleted(
  context: TransformationContext,
  completedResults: ReadonlyArray<CompletedResult>,
): ReadonlyArray<LegacyIncrementalResult> {
  const incremental: Array<LegacyIncrementalResult> = [];
  for (const completedResult of completedResults) {
    const pendingResult = context.pendingResultsById.get(completedResult.id);
    invariant(pendingResult != null);
    const label = pendingResult.label;
    invariant(label != null);

    const streamUsageContext = context.streamUsageMap.get(label);
    if (streamUsageContext) {
      context.streamUsageMap.delete(label);
      if ('errors' in completedResult) {
        const list = getObjectAtPath(context.mergedResult, pendingResult.path);
        invariant(Array.isArray(list));
        const incrementalResult: LegacyIncrementalStreamResult = {
          items: null,
          errors: completedResult.errors,
          path: [...pendingResult.path, list.length],
        };
        incremental.push(incrementalResult);
      }

      context.pendingResultsById.delete(completedResult.id);
      const path = pendingResult.path.join('.');
      const labels = context.pendingLabelsByPath.get(path);
      invariant(labels != null);
      labels.delete(label);
      if (labels.size === 0) {
        context.pendingLabelsByPath.delete(path);
      }
      continue;
    }

    const deferUsageContext = context.deferUsageMap.get(label);
    invariant(deferUsageContext != null);

    let incrementalResult: LegacyIncrementalDeferResult;
    if ('errors' in completedResult) {
      incrementalResult = {
        data: null,
        errors: completedResult.errors,
        path: pendingResult.path,
      };
    } else {
      const object = getObjectAtPath(context.mergedResult, pendingResult.path);
      invariant(isObjectLike(object));
      const typeName = object[context.prefix];
      invariant(typeof typeName === 'string');
      const runtimeType = context.transformedArgs.schema.getType(typeName);
      invariant(isObjectType(runtimeType));

      const errors: Array<GraphQLError> = [];

      const selectionSet = deferUsageContext.selectionSet;
      const selectionSetNode = selectionSet.node
        ? selectionSet.node
        : context.transformedArgs.fragments[selectionSet.fragmentName]
            .definition.selectionSet;

      const objectPath = pathFromArray(pendingResult.path);

      const groupedFieldSet = collectFields(
        context,
        runtimeType,
        selectionSetNode,
        objectPath,
      );

      const data = completeValue(
        context,
        object,
        runtimeType,
        groupedFieldSet,
        errors,
        objectPath,
      );

      incrementalResult = {
        data,
        path: pendingResult.path,
      };

      if (errors.length > 0) {
        incrementalResult.errors = errors;
      }
    }

    const originalLabel = deferUsageContext.originalLabel;
    if (originalLabel != null) {
      incrementalResult.label = originalLabel;
    }

    incremental.push(incrementalResult);

    context.pendingResultsById.delete(completedResult.id);
    const path = pendingResult.path.join('.');
    const labels = context.pendingLabelsByPath.get(path);
    invariant(labels != null);
    labels.delete(label);
    if (labels.size === 0) {
      context.pendingLabelsByPath.delete(path);
    }
  }
  return incremental;
}

function transformInitialResult<
  T extends ExecutionResult | InitialIncrementalExecutionResult,
>(context: TransformationContext, result: T): T {
  const originalData = result.data;
  if (originalData == null) {
    return result;
  }

  const errors = embedErrors(originalData, result.errors);
  context.mergedResult = originalData;

  const { schema, operation } = context.transformedArgs;
  const rootType = schema.getRootType(operation.operation);
  invariant(rootType != null);

  const { pending, ...rest } = result as InitialIncrementalExecutionResult;

  if (pending != null) {
    context.mergedResult[context.prefix] = rootType.name;
    processPending(context, pending);
  }

  // no need to memoize for the initial result as will be called only once
  const groupedFieldSet = _collectFields(
    context,
    rootType,
    operation.selectionSet,
    undefined,
  );
  const data = completeValue(
    context,
    originalData,
    rootType,
    groupedFieldSet,
    errors,
    undefined,
  );

  return (rest.errors ? { ...rest, errors, data } : { ...rest, data }) as T;
}

function pathFromArray(path: ReadonlyArray<string | number>): Path | undefined {
  if (path.length === 0) {
    return undefined;
  }
  let current = addPath(undefined, path[0], undefined);
  for (let i = 1; i < path.length; i++) {
    current = addPath(current, path[i], undefined);
  }
  return current;
}
