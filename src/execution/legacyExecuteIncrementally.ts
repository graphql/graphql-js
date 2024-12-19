import { AccumulatorMap } from '../jsutils/AccumulatorMap.js';
import { getBySet } from '../jsutils/getBySet.js';
import { invariant } from '../jsutils/invariant.js';
import { isSameSet } from '../jsutils/isSameSet.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import { addPath, pathToArray } from '../jsutils/Path.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';

import type { GraphQLError } from '../error/GraphQLError.js';

import type { DeferUsageSet, ExecutionPlan } from './buildExecutionPlan.js';
import type {
  DeferUsage,
  FieldDetails,
  GroupedFieldSet,
} from './collectFields.js';
import type { ExecutionArgs } from './execute.js';
import { validateExecutionArgs } from './execute.js';
import type { ValidatedExecutionArgs } from './Executor.js';
import { Executor } from './Executor.js';
import type { ExperimentalIncrementalExecutionResults } from './IncrementalPublisher.js';
import type {
  PayloadPublisher,
  SubsequentPayloadPublisher,
} from './PayloadPublisher.js';
import type {
  DeferredFragmentRecord,
  DeliveryGroup,
  ExecutionResult,
  FailedExecutionGroup,
  StreamItemsRecordResult,
  StreamRecord,
  SuccessfulExecutionGroup,
} from './types.js';
import { isDeferredFragmentRecord } from './types.js';

interface InitialIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends ExecutionResult<TData, TExtensions> {
  data: TData;
  hasNext: true;
  extensions?: TExtensions;
}

interface SubsequentIncrementalExecutionResult<
  TData = unknown,
  TExtensions = ObjMap<unknown>,
> {
  incremental?: ReadonlyArray<IncrementalResult<TData, TExtensions>>;
  hasNext: boolean;
  extensions?: TExtensions;
}

type IncrementalResult<TData = unknown, TExtensions = ObjMap<unknown>> =
  | IncrementalDeferResult<TData, TExtensions>
  | IncrementalStreamResult<TData, TExtensions>;

interface IncrementalDeferResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends ExecutionResult<TData, TExtensions> {
  path: ReadonlyArray<string | number>;
  label?: string;
}

interface IncrementalStreamResult<
  TData = ReadonlyArray<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLError>;
  items: TData | null;
  path: ReadonlyArray<string | number>;
  label?: string;
  extensions?: TExtensions;
}

export function legacyExecuteIncrementally(
  args: ExecutionArgs,
): PromiseOrValue<
  | ExecutionResult
  | ExperimentalIncrementalExecutionResults<
      InitialIncrementalExecutionResult,
      SubsequentIncrementalExecutionResult
    >
> {
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const validatedExecutionArgs = validateExecutionArgs(args);

  // Return early errors if execution context failed.
  if (!('schema' in validatedExecutionArgs)) {
    return { errors: validatedExecutionArgs };
  }

  return legacyExecuteQueryOrMutationOrSubscriptionEvent(
    validatedExecutionArgs,
  );
}

export function legacyExecuteQueryOrMutationOrSubscriptionEvent(
  validatedExecutionArgs: ValidatedExecutionArgs,
): PromiseOrValue<
  | ExecutionResult
  | ExperimentalIncrementalExecutionResults<
      InitialIncrementalExecutionResult,
      SubsequentIncrementalExecutionResult
    >
> {
  const executor = new Executor(
    validatedExecutionArgs,
    buildBranchingExecutionPlan,
    getBranchingPayloadPublisher,
  );
  return executor.executeQueryOrMutationOrSubscriptionEvent();
}

function buildBranchingExecutionPlan(
  originalGroupedFieldSet: GroupedFieldSet,
  parentDeferUsages: DeferUsageSet = new Set<DeferUsage>(),
): ExecutionPlan {
  const groupedFieldSet = new AccumulatorMap<string, FieldDetails>();

  const newGroupedFieldSets = new Map<
    DeferUsageSet,
    AccumulatorMap<string, FieldDetails>
  >();

  for (const [responseKey, fieldGroup] of originalGroupedFieldSet) {
    for (const fieldDetails of fieldGroup) {
      const deferUsage = fieldDetails.deferUsage;
      const deferUsageSet =
        deferUsage === undefined
          ? new Set<DeferUsage>()
          : new Set([deferUsage]);
      if (isSameSet(parentDeferUsages, deferUsageSet)) {
        groupedFieldSet.add(responseKey, fieldDetails);
      } else {
        let newGroupedFieldSet = getBySet(newGroupedFieldSets, deferUsageSet);
        if (newGroupedFieldSet === undefined) {
          newGroupedFieldSet = new AccumulatorMap();
          newGroupedFieldSets.set(deferUsageSet, newGroupedFieldSet);
        }
        newGroupedFieldSet.add(responseKey, fieldDetails);
      }
    }
  }

  return {
    groupedFieldSet,
    newGroupedFieldSets,
  };
}

function getBranchingPayloadPublisher(): PayloadPublisher<
  InitialIncrementalExecutionResult,
  SubsequentIncrementalExecutionResult
> {
  const indices = new Map<StreamRecord, number>();

  return {
    getInitialPayload,
    getSubsequentPayloadPublisher,
  };

  function getInitialPayload(
    data: ObjMap<unknown>,
    errors: ReadonlyArray<GraphQLError> | undefined,
    newRootNodes: ReadonlyArray<DeliveryGroup>,
  ): InitialIncrementalExecutionResult {
    for (const node of newRootNodes) {
      if (!isDeferredFragmentRecord(node)) {
        indices.set(node, 0);
      }
    }

    return errors === undefined
      ? { data, hasNext: true }
      : { errors, data, hasNext: true };
  }

  function getSubsequentPayloadPublisher(): SubsequentPayloadPublisher<SubsequentIncrementalExecutionResult> {
    const incremental: Array<IncrementalResult> = [];

    return {
      addFailedDeferredFragmentRecord,
      addSuccessfulDeferredFragmentRecord,
      addFailedStreamRecord,
      addSuccessfulStreamRecord,
      addStreamItems,
      getSubsequentPayload,
    };

    function addFailedDeferredFragmentRecord(
      deferredFragmentRecord: DeferredFragmentRecord,
      failedExecutionGroup: FailedExecutionGroup,
    ): void {
      const { path, label } = deferredFragmentRecord;
      const incrementalEntry: IncrementalDeferResult = {
        errors: failedExecutionGroup.errors,
        data: null,
        path: pathToArray(path),
      };
      incrementalEntry.path = pathToArray(path);
      if (label !== undefined) {
        incrementalEntry.label = label;
      }
      incremental.push(incrementalEntry);
    }

    function addSuccessfulDeferredFragmentRecord(
      deferredFragmentRecord: DeferredFragmentRecord,
      newRootNodes: ReadonlyArray<DeliveryGroup>,
      successfulExecutionGroups: ReadonlyArray<SuccessfulExecutionGroup>,
    ): void {
      for (const node of newRootNodes) {
        if (!isDeferredFragmentRecord(node)) {
          indices.set(node, 0);
        }
      }

      for (const successfulExecutionGroup of successfulExecutionGroups) {
        const { path, label } = deferredFragmentRecord;
        const incrementalEntry: IncrementalDeferResult = {
          ...successfulExecutionGroup.result,
          path: pathToArray(path),
        };
        if (label !== undefined) {
          incrementalEntry.label = label;
        }
        incremental.push(incrementalEntry);
      }
    }

    function addFailedStreamRecord(
      streamRecord: StreamRecord,
      errors: ReadonlyArray<GraphQLError>,
    ): void {
      const { path, label } = streamRecord;
      const index = indices.get(streamRecord);
      invariant(index !== undefined);
      const incrementalEntry: IncrementalStreamResult = {
        errors,
        items: null,
        path: pathToArray(addPath(path, index, undefined)),
      };
      if (label !== undefined) {
        incrementalEntry.label = label;
      }
      incremental.push(incrementalEntry);
      indices.delete(streamRecord);
    }

    function addSuccessfulStreamRecord(streamRecord: StreamRecord): void {
      indices.delete(streamRecord);
    }

    function addStreamItems(
      streamRecord: StreamRecord,
      newRootNodes: ReadonlyArray<DeliveryGroup> | undefined,
      result: StreamItemsRecordResult,
    ): void {
      if (newRootNodes !== undefined) {
        for (const node of newRootNodes) {
          if (!isDeferredFragmentRecord(node)) {
            indices.set(node, 0);
          }
        }
      }

      const { path, label } = streamRecord;
      const index = indices.get(streamRecord);
      invariant(index !== undefined);
      const incrementalEntry: IncrementalStreamResult = {
        ...result,
        path: pathToArray(addPath(path, index, undefined)),
      };
      if (label !== undefined) {
        incrementalEntry.label = label;
      }
      incremental.push(incrementalEntry);
    }

    function getSubsequentPayload(
      hasNext: boolean,
    ): SubsequentIncrementalExecutionResult | undefined {
      if (incremental.length > 0) {
        const subsequentIncrementalExecutionResult: SubsequentIncrementalExecutionResult =
          { hasNext };

        if (incremental.length > 0) {
          subsequentIncrementalExecutionResult.incremental = incremental;
        }

        return subsequentIncrementalExecutionResult;
      }
    }
  }
}
