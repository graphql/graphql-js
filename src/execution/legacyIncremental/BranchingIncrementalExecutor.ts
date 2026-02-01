import { AccumulatorMap } from '../../jsutils/AccumulatorMap.js';
import { getBySet } from '../../jsutils/getBySet.js';
import { invariant } from '../../jsutils/invariant.js';
import { isSameSet } from '../../jsutils/isSameSet.js';
import { memoize1 } from '../../jsutils/memoize1.js';
import { memoize2 } from '../../jsutils/memoize2.js';
import type { ObjMap } from '../../jsutils/ObjMap.js';

import type { GraphQLError } from '../../error/GraphQLError.js';

import type {
  DeferUsage,
  FieldDetails,
  GroupedFieldSet,
} from '../collectFields.js';
import type { ExecutionResult } from '../Executor.js';
import type {
  DeferUsageSet,
  ExecutionPlan,
} from '../incremental/buildExecutionPlan.js';
import { IncrementalExecutor } from '../incremental/IncrementalExecutor.js';

import { BranchingIncrementalPublisher } from './BranchingIncrementalPublisher.js';

export interface ExperimentalIncrementalExecutionResults {
  initialResult: InitialIncrementalExecutionResult;
  subsequentResults: AsyncGenerator<
    SubsequentIncrementalExecutionResult,
    void,
    void
  >;
}

export interface InitialIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends ExecutionResult<TData, TExtensions> {
  data: TData;
  hasNext: true;
  extensions?: TExtensions;
}

export interface SubsequentIncrementalExecutionResult<
  TData = unknown,
  TExtensions = ObjMap<unknown>,
> {
  incremental?: ReadonlyArray<IncrementalResult<TData, TExtensions>>;
  hasNext: boolean;
  extensions?: TExtensions;
}

export type IncrementalResult<TData = unknown, TExtensions = ObjMap<unknown>> =
  | IncrementalDeferResult<TData, TExtensions>
  | IncrementalStreamResult<TData, TExtensions>;

export interface IncrementalDeferResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends ExecutionResult<TData, TExtensions> {
  path: ReadonlyArray<string | number>;
  label?: string;
}

export interface IncrementalStreamResult<
  TData = ReadonlyArray<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLError>;
  items: TData | null;
  path: ReadonlyArray<string | number>;
  label?: string;
  extensions?: TExtensions;
}

const buildBranchingExecutionPlanFromInitial = memoize1(
  (groupedFieldSet: GroupedFieldSet) =>
    buildBranchingExecutionPlan(groupedFieldSet),
);

const buildBranchingExecutionPlanFromDeferred = memoize2(
  (groupedFieldSet: GroupedFieldSet, deferUsageSet: DeferUsageSet) =>
    buildBranchingExecutionPlan(groupedFieldSet, deferUsageSet),
);

/** @internal */
export class BranchingIncrementalExecutor extends IncrementalExecutor<ExperimentalIncrementalExecutionResults> {
  override createSubExecutor(
    deferUsageSet?: DeferUsageSet,
  ): IncrementalExecutor<ExperimentalIncrementalExecutionResults> {
    return new BranchingIncrementalExecutor(
      this.validatedExecutionArgs,
      deferUsageSet,
    );
  }

  override buildResponse(
    data: ObjMap<unknown> | null,
  ): ExecutionResult | ExperimentalIncrementalExecutionResults {
    const errors = this.collectedErrors.errors;
    const work = this.getIncrementalWork();
    const { tasks, streams } = work;
    if (tasks?.length === 0 && streams?.length === 0) {
      return errors.length ? { errors, data } : { data };
    }

    invariant(data !== null);
    const incrementalPublisher = new BranchingIncrementalPublisher();
    return incrementalPublisher.buildResponse(
      data,
      errors,
      work,
      this.validatedExecutionArgs.externalAbortSignal,
    );
  }

  override buildRootExecutionPlan(
    originalGroupedFieldSet: GroupedFieldSet,
  ): ExecutionPlan {
    return buildBranchingExecutionPlanFromInitial(originalGroupedFieldSet);
  }

  override buildSubExecutionPlan(
    originalGroupedFieldSet: GroupedFieldSet,
  ): ExecutionPlan {
    return this.deferUsageSet === undefined
      ? buildBranchingExecutionPlanFromInitial(originalGroupedFieldSet)
      : buildBranchingExecutionPlanFromDeferred(
          originalGroupedFieldSet,
          this.deferUsageSet,
        );
  }
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
