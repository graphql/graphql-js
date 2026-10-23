/** @category Legacy Incremental Execution */

import { AccumulatorMap } from '../../jsutils/AccumulatorMap.ts';
import { invariant } from '../../jsutils/invariant.ts';
import { isSameSet } from '../../jsutils/isSameSet.ts';
import { memoize1 } from '../../jsutils/memoize1.ts';
import { memoize2 } from '../../jsutils/memoize2.ts';
import type { ObjMap } from '../../jsutils/ObjMap.ts';
import { SetMap } from '../../jsutils/SetMap.ts';

import type {
  GraphQLError,
  GraphQLFormattedError,
} from '../../error/GraphQLError.ts';

import type {
  DeferUsage,
  FieldDetails,
  GroupedFieldSet,
} from '../collectFields.ts';
import type { ExecutionResult, FormattedExecutionResult } from '../Executor.ts';
import type {
  DeferUsageSet,
  ExecutionPlan,
} from '../incremental/buildExecutionPlan.ts';
import { IncrementalExecutor } from '../incremental/IncrementalExecutor.ts';

import { BranchingIncrementalPublisher } from './BranchingIncrementalPublisher.ts';

/**
 * Results for an operation that produced legacy incremental payloads.
 * @typeParam TInitialData - Shape of the initial result data payload.
 * @typeParam TDeferredData - Shape of deferred fragment data payloads.
 * @typeParam TStreamItem - Shape of streamed list items.
 * @typeParam TExtensions - Shape of extensions payloads.
 */
export interface LegacyExperimentalIncrementalExecutionResults<
  TInitialData = ObjMap<unknown>,
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> {
  /** Initial execution result delivered before subsequent legacy incremental payloads. */
  initialResult: LegacyInitialIncrementalExecutionResult<
    TInitialData,
    TExtensions
  >;
  /** Async stream of legacy incremental payloads delivered after the initial result. */
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

/**
 * Initial execution result for an operation that produced legacy incremental payloads.
 *
 * Unlike `InitialIncrementalExecutionResult`, the legacy initial result does
 * not include a `pending` list. Subsequent payloads identify their location
 * directly with `path` and optional `label` fields.
 * @typeParam TInitialData - Shape of the initial data payload.
 * @typeParam TExtensions - Shape of the extensions payload.
 */
export interface LegacyInitialIncrementalExecutionResult<
  TInitialData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends ExecutionResult<TInitialData, TExtensions> {
  /** Data produced by the initial execution payload. */
  data: TInitialData;
  /** Indicates that subsequent legacy incremental payloads will follow. */
  hasNext: true;
  /** Additional non-standard metadata included in the initial result. */
  extensions?: TExtensions;
}

/**
 * Subsequent payload produced by legacy incremental execution.
 *
 * Legacy subsequent payloads may contain deferred fragment data, streamed list
 * items, or only `hasNext: false` to complete the response stream.
 * @typeParam TDeferredData - Shape of deferred fragment data payloads.
 * @typeParam TStreamItem - Shape of streamed list items.
 * @typeParam TExtensions - Shape of the extensions payload.
 */
export interface LegacySubsequentIncrementalExecutionResult<
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> {
  /** Deferred or streamed payloads delivered by this response. */
  incremental?: ReadonlyArray<
    LegacyIncrementalResult<TDeferredData, TStreamItem, TExtensions>
  >;
  /** Indicates whether more legacy incremental payloads will follow. */
  hasNext: boolean;
  /** Additional non-standard metadata included in this payload. */
  extensions?: TExtensions;
}

/**
 * Deferred fragment or streamed list payload produced by legacy incremental execution.
 * @typeParam TDeferredData - Shape of deferred fragment data.
 * @typeParam TStreamItem - Shape of streamed list items.
 * @typeParam TExtensions - Shape of extensions payloads.
 */
export type LegacyIncrementalResult<
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> =
  | LegacyIncrementalDeferResult<TDeferredData, TExtensions>
  | LegacyIncrementalStreamResult<TStreamItem, TExtensions>;

/**
 * Legacy incremental payload produced by a deferred fragment.
 *
 * The payload location is identified directly by `path` and optional `label`
 * instead of by an `id` from a pending entry.
 * @typeParam TDeferredData - Shape of deferred fragment data.
 * @typeParam TExtensions - Shape of extensions payloads.
 */
export interface LegacyIncrementalDeferResult<
  TDeferredData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends ExecutionResult<TDeferredData, TExtensions> {
  /** Response path to the deferred fragment payload. */
  path: ReadonlyArray<string | number>;
  /** Label from the `@defer` directive. */
  label?: string;
}

/**
 * Legacy incremental payload produced by a streamed list field.
 * @typeParam TStreamItem - Shape of streamed list items.
 * @typeParam TExtensions - Shape of extensions payloads.
 */
export interface LegacyIncrementalStreamResult<
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> {
  /** Errors raised while producing streamed items. */
  errors?: ReadonlyArray<GraphQLError>;
  /** Streamed list items delivered by this payload. */
  items: ReadonlyArray<TStreamItem> | null;
  /** Response path to the first streamed list item in this payload. */
  path: ReadonlyArray<string | number>;
  /** Label from the `@stream` directive. */
  label?: string;
  /** Additional non-standard metadata included in this payload. */
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

/**
 * JSON-serializable form of legacy incremental execution results.
 * @typeParam TInitialData - Shape of the formatted initial result data payload.
 * @typeParam TDeferredData - Shape of formatted deferred fragment data payloads.
 * @typeParam TStreamItem - Shape of formatted streamed list items.
 * @typeParam TExtensions - Shape of formatted extensions payloads.
 */
export interface FormattedLegacyExperimentalIncrementalExecutionResults<
  TInitialData = ObjMap<unknown>,
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> {
  /** Formatted initial execution result. */
  initialResult: FormattedLegacyInitialIncrementalExecutionResult<
    TInitialData,
    TExtensions
  >;
  /** Async stream of formatted legacy incremental payloads. */
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

/**
 * JSON-serializable form of a legacy initial incremental execution result.
 * @typeParam TInitialData - Shape of the formatted initial data payload.
 * @typeParam TExtensions - Shape of the formatted extensions payload.
 */
export interface FormattedLegacyInitialIncrementalExecutionResult<
  TInitialData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends FormattedExecutionResult<TInitialData, TExtensions> {
  /** Formatted data produced by the initial execution payload. */
  data: TInitialData;
  /** Indicates that subsequent legacy incremental payloads will follow. */
  hasNext: true;
  /** Additional non-standard metadata included in the formatted initial result. */
  extensions?: TExtensions;
}

/**
 * JSON-serializable form of a legacy subsequent incremental execution payload.
 * @typeParam TDeferredData - Shape of formatted deferred fragment data payloads.
 * @typeParam TStreamItem - Shape of formatted streamed list items.
 * @typeParam TExtensions - Shape of formatted extensions payloads.
 */
export interface FormattedLegacySubsequentIncrementalExecutionResult<
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> {
  /** Formatted deferred or streamed payloads delivered by this response. */
  incremental?: ReadonlyArray<
    FormattedLegacyIncrementalResult<TDeferredData, TStreamItem, TExtensions>
  >;
  /** Indicates whether more legacy incremental payloads will follow. */
  hasNext: boolean;
  /** Additional non-standard metadata included in this formatted payload. */
  extensions?: TExtensions;
}

/**
 * JSON-serializable deferred fragment or streamed list payload produced by
 * legacy incremental execution.
 * @typeParam TDeferredData - Shape of formatted deferred fragment data.
 * @typeParam TStreamItem - Shape of formatted streamed list items.
 * @typeParam TExtensions - Shape of formatted extensions payloads.
 */
export type FormattedLegacyIncrementalResult<
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> =
  | FormattedLegacyIncrementalDeferResult<TDeferredData, TExtensions>
  | FormattedLegacyIncrementalStreamResult<TStreamItem, TExtensions>;

/**
 * JSON-serializable form of a legacy deferred fragment payload.
 * @typeParam TDeferredData - Shape of formatted deferred fragment data.
 * @typeParam TExtensions - Shape of formatted extensions payloads.
 */
export interface FormattedLegacyIncrementalDeferResult<
  TDeferredData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends FormattedExecutionResult<TDeferredData, TExtensions> {
  /** Response path to the formatted deferred fragment payload. */
  path: ReadonlyArray<string | number>;
  /** Label from the `@defer` directive. */
  label?: string;
}

/**
 * JSON-serializable form of a legacy streamed list payload.
 * @typeParam TStreamItem - Shape of formatted streamed list items.
 * @typeParam TExtensions - Shape of formatted extensions payloads.
 */
export interface FormattedLegacyIncrementalStreamResult<
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> {
  /** Formatted errors raised while producing streamed items. */
  errors?: ReadonlyArray<GraphQLFormattedError>;
  /** Formatted streamed list items delivered by this payload. */
  items: ReadonlyArray<TStreamItem> | null;
  /** Response path to the first streamed list item in this formatted payload. */
  path: ReadonlyArray<string | number>;
  /** Label from the `@stream` directive. */
  label?: string;
  /** Additional non-standard metadata included in this formatted payload. */
  extensions?: TExtensions;
}
/** @internal */
export class BranchingIncrementalExecutor extends IncrementalExecutor<LegacyExperimentalIncrementalExecutionResults> {
  override getCreateSubExecutor(): (
    deferUsageSet?: DeferUsageSet,
  ) => BranchingIncrementalExecutor {
    const validatedExecutionArgs = this.validatedExecutionArgs;
    const sharedExecutionContext = this.sharedExecutionContext;

    return (deferUsageSet?: DeferUsageSet) =>
      new BranchingIncrementalExecutor(
        validatedExecutionArgs,
        sharedExecutionContext,
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
      this.getFinishSharedExecution(),
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

  const newGroupedFieldSets = new SetMap<
    DeferUsage,
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
        const newGroupedFieldSet = newGroupedFieldSets.getOrInsertComputed(
          deferUsageSet,
          () => new AccumulatorMap(),
        );
        newGroupedFieldSet.add(responseKey, fieldDetails);
      }
    }
  }

  return {
    groupedFieldSet,
    newGroupedFieldSets,
  };
}
