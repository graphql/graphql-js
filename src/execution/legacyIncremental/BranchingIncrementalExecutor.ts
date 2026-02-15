import { AccumulatorMap } from '../../jsutils/AccumulatorMap.js';
import { getBySet } from '../../jsutils/getBySet.js';
import { invariant } from '../../jsutils/invariant.js';
import { isSameSet } from '../../jsutils/isSameSet.js';
import { memoize1 } from '../../jsutils/memoize1.js';
import { memoize2 } from '../../jsutils/memoize2.js';
import type { ObjMap } from '../../jsutils/ObjMap.js';

import type {
  GraphQLError,
  GraphQLFormattedError,
} from '../../error/GraphQLError.js';

import type {
  DeferUsage,
  FieldDetails,
  GroupedFieldSet,
} from '../collectFields.js';
import type { ExecutionResult, FormattedExecutionResult } from '../Executor.js';
import type {
  DeferUsageSet,
  ExecutionPlan,
} from '../incremental/buildExecutionPlan.js';
import { IncrementalExecutor } from '../incremental/IncrementalExecutor.js';

import { BranchingIncrementalPublisher } from './BranchingIncrementalPublisher.js';

export interface LegacyExperimentalIncrementalExecutionResults<
  TInitialData = ObjMap<unknown>,
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> {
  initialResult: LegacyInitialIncrementalExecutionResult<
    TInitialData,
    TExtensions
  >;
  subsequentResults: AsyncGenerator<
    LegacySubsequentIncrementalExecutionResult<
      TDeferredData,
      TStreamItem,
      TExtensions
    >,
    void,
    void
  >;
}

export interface LegacyInitialIncrementalExecutionResult<
  TInitialData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends ExecutionResult<TInitialData, TExtensions> {
  data: TInitialData;
  hasNext: true;
  extensions?: TExtensions;
}

export interface LegacySubsequentIncrementalExecutionResult<
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> {
  incremental?: ReadonlyArray<
    LegacyIncrementalResult<TDeferredData, TStreamItem, TExtensions>
  >;
  hasNext: boolean;
  extensions?: TExtensions;
}

export type LegacyIncrementalResult<
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> =
  | LegacyIncrementalDeferResult<TDeferredData, TExtensions>
  | LegacyIncrementalStreamResult<TStreamItem, TExtensions>;

export interface LegacyIncrementalDeferResult<
  TDeferredData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends ExecutionResult<TDeferredData, TExtensions> {
  path: ReadonlyArray<string | number>;
  label?: string;
}

export interface LegacyIncrementalStreamResult<
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLError>;
  items: ReadonlyArray<TStreamItem> | null;
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

export interface FormattedLegacyExperimentalIncrementalExecutionResults<
  TInitialData = ObjMap<unknown>,
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> {
  initialResult: FormattedLegacyInitialIncrementalExecutionResult<
    TInitialData,
    TExtensions
  >;
  subsequentResults: AsyncGenerator<
    FormattedLegacySubsequentIncrementalExecutionResult<
      TDeferredData,
      TStreamItem,
      TExtensions
    >,
    void,
    void
  >;
}

export interface FormattedLegacyInitialIncrementalExecutionResult<
  TInitialData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends FormattedExecutionResult<TInitialData, TExtensions> {
  data: TInitialData;
  hasNext: true;
  extensions?: TExtensions;
}

export interface FormattedLegacySubsequentIncrementalExecutionResult<
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> {
  incremental?: ReadonlyArray<
    FormattedLegacyIncrementalResult<TDeferredData, TStreamItem, TExtensions>
  >;
  hasNext: boolean;
  extensions?: TExtensions;
}

export type FormattedLegacyIncrementalResult<
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> =
  | FormattedLegacyIncrementalDeferResult<TDeferredData, TExtensions>
  | FormattedLegacyIncrementalStreamResult<TStreamItem, TExtensions>;

export interface FormattedLegacyIncrementalDeferResult<
  TDeferredData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends FormattedExecutionResult<TDeferredData, TExtensions> {
  path: ReadonlyArray<string | number>;
  label?: string;
}

export interface FormattedLegacyIncrementalStreamResult<
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLFormattedError>;
  items: ReadonlyArray<TStreamItem> | null;
  path: ReadonlyArray<string | number>;
  label?: string;
  extensions?: TExtensions;
}
/** @internal */
export class BranchingIncrementalExecutor extends IncrementalExecutor<LegacyExperimentalIncrementalExecutionResults> {
  override createSubExecutor(
    deferUsageSet?: DeferUsageSet,
  ): IncrementalExecutor<LegacyExperimentalIncrementalExecutionResults> {
    return new BranchingIncrementalExecutor(
      this.validatedExecutionArgs,
      this.sharedResolverAbortSignal,
      deferUsageSet,
    );
  }

  override buildResponse(
    data: ObjMap<unknown> | null,
  ): ExecutionResult | LegacyExperimentalIncrementalExecutionResults {
    const work = this.getIncrementalWork();
    const { tasks, streams } = work;
    if (tasks?.length === 0 && streams?.length === 0) {
      return super.buildResponse(data);
    }

    const errors = this.collectedErrors.errors;
    invariant(data !== null);
    const incrementalPublisher = new BranchingIncrementalPublisher();
    return incrementalPublisher.buildResponse(
      data,
      errors,
      work,
      this.validatedExecutionArgs.externalAbortSignal,
      () => this.resolverAbortController?.abort(),
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
