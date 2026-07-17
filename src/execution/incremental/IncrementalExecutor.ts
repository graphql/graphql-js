/** @category Incremental Execution */

/* eslint-disable max-params */
import { invariant } from '../../jsutils/invariant.ts';
import { isPromise, isPromiseLike } from '../../jsutils/isPromise.ts';
import { memoize1 } from '../../jsutils/memoize1.ts';
import { memoize2 } from '../../jsutils/memoize2.ts';
import type { ObjMap } from '../../jsutils/ObjMap.ts';
import type { Path } from '../../jsutils/Path.ts';
import { addPath, pathToArray } from '../../jsutils/Path.ts';
import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.ts';
import type { SetMap } from '../../jsutils/SetMap.ts';

import type {
  GraphQLError,
  GraphQLFormattedError,
} from '../../error/GraphQLError.ts';
import { locatedError } from '../../error/locatedError.ts';

import type { FieldNode } from '../../language/ast.ts';
import { OperationTypeNode } from '../../language/ast.ts';

import type {
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLResolveInfo,
} from '../../type/definition.ts';

import type {
  DeferUsage,
  FieldDetailsList,
  GroupedFieldSet,
} from '../collectFields.ts';
import { collectSubfields as _collectSubfields } from '../collectFields.ts';
import { collectIteratorPromises } from '../collectIteratorPromises.ts';
import type { SharedExecutionContext } from '../createSharedExecutionContext.ts';
import type { ValidatedExecutionArgs } from '../ExecutionArgs.ts';
import type { ExecutionResult, FormattedExecutionResult } from '../Executor.ts';
import { Executor } from '../Executor.ts';
import type { StreamUsage } from '../getStreamUsage.ts';
import { returnIteratorCatchingErrors } from '../returnIteratorCatchingErrors.ts';

import type { DeferUsageSet, ExecutionPlan } from './buildExecutionPlan.ts';
import { buildExecutionPlan } from './buildExecutionPlan.ts';
import { Computation } from './Computation.ts';
import { IncrementalPublisher } from './IncrementalPublisher.ts';
import { Queue } from './Queue.ts';
import type { Group, Stream, Task, Work } from './WorkQueue.ts';

const buildExecutionPlanFromInitial = memoize1(
  (groupedFieldSet: GroupedFieldSet) => buildExecutionPlan(groupedFieldSet),
);

const buildExecutionPlanFromDeferred = memoize2(
  (groupedFieldSet: GroupedFieldSet, deferUsageSet: DeferUsageSet) =>
    buildExecutionPlan(groupedFieldSet, deferUsageSet),
);

/**
 * Results for an operation that produced incremental payloads.
 * @typeParam TInitialData - Shape of the initial result data payload.
 * @typeParam TDeferredData - Shape of deferred fragment data payloads.
 * @typeParam TStreamItem - Shape of streamed list items.
 * @typeParam TExtensions - Shape of extensions payloads.
 */
export interface ExperimentalIncrementalExecutionResults<
  TInitialData = ObjMap<unknown>,
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> {
  /** Initial execution result delivered before subsequent incremental payloads. */
  initialResult: InitialIncrementalExecutionResult<TInitialData, TExtensions>;
  /** Async stream of incremental payloads delivered after the initial result. */
  subsequentResults: AsyncGenerator<
    SubsequentIncrementalExecutionResult<
      TDeferredData,
      TStreamItem,
      TExtensions
    >,
    void,
    void
  >;
}

/**
 * JSON-serializable form of incremental execution results.
 * @typeParam TInitial - Shape of the formatted initial result data payload.
 * @typeParam TDeferredData - Shape of formatted deferred fragment data payloads.
 * @typeParam TStreamItem - Shape of formatted streamed list items.
 * @typeParam TExtensions - Shape of formatted extensions payloads.
 */
export interface FormattedExperimentalIncrementalExecutionResults<
  TInitial = ObjMap<unknown>,
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> {
  /** Formatted initial execution result. */
  initialResult: FormattedInitialIncrementalExecutionResult<
    TInitial,
    TExtensions
  >;
  /** Async stream of formatted incremental payloads. */
  subsequentResults: AsyncGenerator<
    FormattedSubsequentIncrementalExecutionResult<
      TDeferredData,
      TStreamItem,
      TExtensions
    >,
    void,
    void
  >;
}
/**
 * Initial execution result for an operation that produced incremental payloads.
 * @typeParam TData - Shape of the initial data payload.
 * @typeParam TExtensions - Shape of the extensions payload.
 */
export interface InitialIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends ExecutionResult<TData, TExtensions> {
  /** Data produced by the initial execution payload. */
  data: TData;
  /** Incremental payloads that are still pending after the initial result. */
  pending: ReadonlyArray<PendingResult>;
  /** Indicates that subsequent incremental payloads will follow. */
  hasNext: true;
  /** Additional non-standard metadata included in the initial result. */
  extensions?: TExtensions;
}

/**
 * JSON-serializable form of an initial incremental execution result.
 * @typeParam TInitialData - Shape of the formatted initial data payload.
 * @typeParam TExtensions - Shape of the formatted extensions payload.
 */
export interface FormattedInitialIncrementalExecutionResult<
  TInitialData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends FormattedExecutionResult<TInitialData, TExtensions> {
  /** Formatted data produced by the initial execution payload. */
  data: TInitialData;
  /** Formatted list of incremental payloads still pending after the initial result. */
  pending: ReadonlyArray<PendingResult>;
  /** Indicates whether subsequent incremental payloads will follow. */
  hasNext: boolean;
  /** Additional non-standard metadata included in the formatted initial result. */
  extensions?: TExtensions;
}

/**
 * Subsequent payload produced by incremental execution.
 * @typeParam TDeferredData - Shape of deferred fragment data payloads.
 * @typeParam TStreamItem - Shape of streamed list items.
 * @typeParam TExtensions - Shape of the extensions payload.
 */
export interface SubsequentIncrementalExecutionResult<
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> {
  /** Incremental payloads that became pending with this response. */
  pending?: ReadonlyArray<PendingResult>;
  /** Deferred or streamed payloads delivered by this response. */
  incremental?: ReadonlyArray<
    IncrementalResult<TDeferredData, TStreamItem, TExtensions>
  >;
  /** Incremental payloads that completed with this response. */
  completed?: ReadonlyArray<CompletedResult>;
  /** Indicates whether more incremental payloads will follow. */
  hasNext: boolean;
  /** Additional non-standard metadata included in this payload. */
  extensions?: TExtensions;
}

/**
 * JSON-serializable form of a subsequent incremental execution payload.
 * @typeParam TDeferredData - Shape of formatted deferred fragment data payloads.
 * @typeParam TStreamItem - Shape of formatted streamed list items.
 * @typeParam TExtensions - Shape of formatted extensions payloads.
 */
export interface FormattedSubsequentIncrementalExecutionResult<
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> {
  /** Indicates whether more incremental payloads will follow. */
  hasNext: boolean;
  /** Formatted incremental payloads that became pending with this response. */
  pending?: ReadonlyArray<PendingResult>;
  /** Formatted deferred or streamed payloads delivered by this response. */
  incremental?: ReadonlyArray<
    FormattedIncrementalResult<TDeferredData, TStreamItem, TExtensions>
  >;
  /** Formatted incremental payloads that completed with this response. */
  completed?: ReadonlyArray<FormattedCompletedResult>;
  /** Additional non-standard metadata included in this formatted payload. */
  extensions?: TExtensions;
}

/**
 * Incremental payload produced by a deferred fragment.
 * @typeParam TDeferredData - Shape of deferred fragment data.
 * @typeParam TExtensions - Shape of extensions payloads.
 */
export interface IncrementalDeferResult<
  TDeferredData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  /** Identifier matching this payload to a pending deferred fragment. */
  id: string;
  /** Path from the deferred fragment location to this payload. */
  subPath?: ReadonlyArray<string | number>;
  /** Errors raised while executing the deferred fragment. */
  errors?: ReadonlyArray<GraphQLError>;
  /** Data produced by the deferred fragment. */
  data: TDeferredData;
  /** Additional non-standard metadata included in this payload. */
  extensions?: TExtensions;
}

/**
 * JSON-serializable form of a deferred fragment payload.
 * @typeParam TDeferredData - Shape of formatted deferred fragment data.
 * @typeParam TExtensions - Shape of formatted extensions payloads.
 */
export interface FormattedIncrementalDeferResult<
  TDeferredData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  /** Formatted errors raised while executing the deferred fragment. */
  errors?: ReadonlyArray<GraphQLFormattedError>;
  /** Formatted data produced by the deferred fragment. */
  data: TDeferredData;
  /** Identifier matching this payload to a pending deferred fragment. */
  id: string;
  /** Path from the deferred fragment location to this payload. */
  subPath?: ReadonlyArray<string | number>;
  /** Additional non-standard metadata included in this formatted payload. */
  extensions?: TExtensions;
}

/**
 * Incremental payload produced by a streamed list field.
 * @typeParam TStreamItem - Shape of streamed list items.
 * @typeParam TExtensions - Shape of extensions payloads.
 */
export interface IncrementalStreamResult<
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> {
  /** Identifier matching this payload to a pending stream. */
  id: string;
  /** Path from the streamed field location to these items. */
  subPath?: ReadonlyArray<string | number>;
  /** Errors raised while producing streamed items. */
  errors?: ReadonlyArray<GraphQLError>;
  /** Streamed list items delivered by this payload. */
  items: ReadonlyArray<TStreamItem>;
  /** Additional non-standard metadata included in this payload. */
  extensions?: TExtensions;
}

/**
 * JSON-serializable form of a streamed list payload.
 * @typeParam TStreamItem - Shape of formatted streamed list items.
 * @typeParam TExtensions - Shape of formatted extensions payloads.
 */
export interface FormattedIncrementalStreamResult<
  TStreamItem = Array<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  /** Formatted errors raised while producing streamed items. */
  errors?: ReadonlyArray<GraphQLFormattedError>;
  /** Formatted streamed list items delivered by this payload. */
  items: ReadonlyArray<TStreamItem>;
  /** Identifier matching this payload to a pending stream. */
  id: string;
  /** Path from the streamed field location to these items. */
  subPath?: ReadonlyArray<string | number>;
  /** Additional non-standard metadata included in this formatted payload. */
  extensions?: TExtensions;
}

/**
 * Deferred fragment or streamed list payload produced by incremental execution.
 * @typeParam TDeferredData - Shape of deferred fragment data.
 * @typeParam TStreamItem - Shape of streamed list items.
 * @typeParam TExtensions - Shape of extensions payloads.
 */
export type IncrementalResult<
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> =
  | IncrementalDeferResult<TDeferredData, TExtensions>
  | IncrementalStreamResult<TStreamItem, TExtensions>;

/**
 * JSON-serializable deferred fragment or streamed list payload.
 * @typeParam TDeferredData - Shape of formatted deferred fragment data.
 * @typeParam TStreamItem - Shape of formatted streamed list items.
 * @typeParam TExtensions - Shape of formatted extensions payloads.
 */
export type FormattedIncrementalResult<
  TDeferredData = ObjMap<unknown>,
  TStreamItem = unknown,
  TExtensions = ObjMap<unknown>,
> =
  | FormattedIncrementalDeferResult<TDeferredData, TExtensions>
  | FormattedIncrementalStreamResult<TStreamItem, TExtensions>;

/** @internal */
export interface PendingResult {
  id: string;
  path: ReadonlyArray<string | number>;
  label?: string;
}

/** @internal */
export interface CompletedResult {
  id: string;
  errors?: ReadonlyArray<GraphQLError>;
}

/** @internal */
export interface FormattedCompletedResult {
  id: string;
  errors?: ReadonlyArray<GraphQLFormattedError>;
}

interface ExecutionGroup extends Task<
  ExecutionGroupValue,
  StreamItemValue,
  DeliveryGroup,
  ItemStream
> {
  groups: ReadonlyArray<DeliveryGroup>;
  path: Path | undefined;
  computation: Computation<ExecutionGroupResult>;
}

/** @internal */
export interface DeliveryGroup extends Group<DeliveryGroup> {
  path: Path | undefined;
  label: string | undefined;
  parent: DeliveryGroup | undefined;
}

/** @internal */
export interface ItemStream extends Stream<
  ExecutionGroupValue,
  StreamItemValue,
  DeliveryGroup,
  ItemStream
> {
  path: Path;
  label: string | undefined;
  initialCount: number;
}

/** @internal */
export interface ExecutionGroupValue {
  deliveryGroups: ReadonlyArray<DeliveryGroup>;
  path: ReadonlyArray<string | number>;
  errors?: ReadonlyArray<GraphQLError>;
  data: ObjMap<unknown>;
}

/** @internal */
export type IncrementalWork = Work<
  ExecutionGroupValue,
  StreamItemValue,
  DeliveryGroup,
  ItemStream
>;

/** @internal */
export interface ExecutionGroupResult {
  value: ExecutionGroupValue;
  work?: IncrementalWork | undefined;
}

/** @internal */
export interface StreamItemValue {
  errors?: ReadonlyArray<GraphQLError>;
  item: unknown;
}

/** @internal */
export interface StreamItemResult {
  value: StreamItemValue;
  work?: IncrementalWork | undefined;
}

/** @internal */
export class IncrementalExecutor<
  TExperimental = ExperimentalIncrementalExecutionResults,
> extends Executor<ReadonlyMap<DeferUsage, DeliveryGroup>, TExperimental> {
  deferUsageSet?: DeferUsageSet | undefined;
  groups: Array<DeliveryGroup>;
  tasks: Array<ExecutionGroup>;
  streams: Array<ItemStream>;

  constructor(
    validatedExecutionArgs: ValidatedExecutionArgs,
    sharedExecutionContext?: SharedExecutionContext,
    deferUsageSet?: DeferUsageSet,
  ) {
    super(validatedExecutionArgs, sharedExecutionContext);
    this.deferUsageSet = deferUsageSet;
    this.groups = [];
    this.tasks = [];
    this.streams = [];
  }

  getCreateSubExecutor(): (
    deferUsageSet?: DeferUsageSet,
  ) => IncrementalExecutor<TExperimental> {
    const validatedExecutionArgs = this.validatedExecutionArgs;
    const sharedExecutionContext = this.sharedExecutionContext;

    return (deferUsageSet?: DeferUsageSet) =>
      new IncrementalExecutor<TExperimental>(
        validatedExecutionArgs,
        sharedExecutionContext,
        deferUsageSet,
      );
  }

  override abort(reason?: unknown): void {
    super.abort(reason);
    for (const task of this.tasks) {
      const aborted = task.computation.abort(reason);
      invariant(!isPromise(aborted));
    }
    for (const stream of this.streams) {
      const aborted = stream.queue.abort(reason);
      invariant(!isPromise(aborted));
    }
  }

  /**
   * Given a completed execution context and data, build the `{ errors, data }`
   * response defined by the "Response" section of the GraphQL specification.
   *
   * @internal
   */
  override buildResponse(
    data: ObjMap<unknown> | null,
  ): ExecutionResult | TExperimental {
    const work = this.getIncrementalWork();
    const { tasks, streams } = work;
    if (tasks?.length === 0 && streams?.length === 0) {
      return super.buildResponse(data);
    }

    const errors = this.collectedErrors.errors;
    invariant(data !== null);
    const incrementalPublisher = new IncrementalPublisher();
    return incrementalPublisher.buildResponse(
      data,
      errors,
      work,
      this.validatedExecutionArgs.externalAbortSignal,
      this.getFinishSharedExecution(),
    ) as TExperimental;
  }

  override executeCollectedRootFields(
    rootType: GraphQLObjectType,
    rootValue: unknown,
    originalGroupedFieldSet: GroupedFieldSet,
    serially: boolean,
    newDeferUsages: ReadonlyArray<DeferUsage>,
  ): PromiseOrValue<ObjMap<unknown>> {
    if (newDeferUsages.length === 0) {
      return this.executeRootGroupedFieldSet(
        rootType,
        rootValue,
        originalGroupedFieldSet,
        serially,
        undefined,
      );
    }

    invariant(
      this.validatedExecutionArgs.operation.operation !==
        OperationTypeNode.SUBSCRIPTION,
      '`@defer` directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
    );

    const { newDeliveryGroups, newDeliveryGroupMap } =
      this.getNewDeliveryGroupMap(newDeferUsages, undefined, undefined);

    const { groupedFieldSet, newGroupedFieldSets } =
      this.buildRootExecutionPlan(originalGroupedFieldSet);

    const data = this.executeRootGroupedFieldSet(
      rootType,
      rootValue,
      groupedFieldSet,
      serially,
      newDeliveryGroupMap,
    );

    this.groups.push(...newDeliveryGroups);

    if (newGroupedFieldSets.size > 0) {
      this.collectExecutionGroups(
        rootType,
        rootValue,
        undefined,
        newGroupedFieldSets,
        newDeliveryGroupMap,
      );
    }

    return data;
  }

  buildRootExecutionPlan(
    originalGroupedFieldSet: GroupedFieldSet,
  ): ExecutionPlan {
    return buildExecutionPlanFromInitial(originalGroupedFieldSet);
  }

  override executeCollectedSubfields(
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    path: Path | undefined,
    originalGroupedFieldSet: GroupedFieldSet,
    newDeferUsages: ReadonlyArray<DeferUsage>,
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup> | undefined,
  ): PromiseOrValue<ObjMap<unknown>> {
    if (newDeferUsages.length > 0) {
      invariant(
        this.validatedExecutionArgs.operation.operation !==
          OperationTypeNode.SUBSCRIPTION,
        '`@defer` directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
      );
    }

    if (deliveryGroupMap === undefined && newDeferUsages.length === 0) {
      return this.executeFields(
        parentType,
        sourceValue,
        path,
        originalGroupedFieldSet,
        deliveryGroupMap,
      );
    }

    const { newDeliveryGroups, newDeliveryGroupMap } =
      this.getNewDeliveryGroupMap(newDeferUsages, deliveryGroupMap, path);

    const { groupedFieldSet, newGroupedFieldSets } = this.buildSubExecutionPlan(
      originalGroupedFieldSet,
    );

    const data = this.executeFields(
      parentType,
      sourceValue,
      path,
      groupedFieldSet,
      newDeliveryGroupMap,
    );

    this.groups.push(...newDeliveryGroups);

    if (newGroupedFieldSets.size > 0) {
      this.collectExecutionGroups(
        parentType,
        sourceValue,
        path,
        newGroupedFieldSets,
        newDeliveryGroupMap,
      );
    }

    return data;
  }

  buildSubExecutionPlan(
    originalGroupedFieldSet: GroupedFieldSet,
  ): ExecutionPlan {
    return this.deferUsageSet === undefined
      ? buildExecutionPlanFromInitial(originalGroupedFieldSet)
      : buildExecutionPlanFromDeferred(
          originalGroupedFieldSet,
          this.deferUsageSet,
        );
  }

  collectExecutionGroups(
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    path: Path | undefined,
    newGroupedFieldSets: SetMap<DeferUsage, GroupedFieldSet>,
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup>,
  ): void {
    const createSubExecutor = this.getCreateSubExecutor();
    for (const [deferUsageSet, groupedFieldSet] of newGroupedFieldSets) {
      const deliveryGroups = getDeliveryGroups(deferUsageSet, deliveryGroupMap);

      const executor = createSubExecutor(deferUsageSet);

      const executionGroup: ExecutionGroup = {
        groups: deliveryGroups,
        path,
        computation: new Computation(
          () =>
            executor.executeExecutionGroup(
              deliveryGroups,
              parentType,
              sourceValue,
              path,
              groupedFieldSet,
              deliveryGroupMap,
            ),
          (reason) => executor.abort(reason),
        ),
      };

      const parentDeferUsages = this.deferUsageSet;

      if (this.validatedExecutionArgs.enableEarlyExecution) {
        if (this.shouldDefer(parentDeferUsages, deferUsageSet)) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          Promise.resolve().then(() => executionGroup.computation.prime());
        } else {
          executionGroup.computation.prime();
        }
      }

      this.tasks.push(executionGroup);
    }
  }

  executeExecutionGroup(
    deliveryGroups: ReadonlyArray<DeliveryGroup>,
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    path: Path | undefined,
    groupedFieldSet: GroupedFieldSet,
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup>,
  ): PromiseOrValue<ExecutionGroupResult> {
    let result;
    try {
      result = this.executeFields(
        parentType,
        sourceValue,
        path,
        groupedFieldSet,
        deliveryGroupMap,
      );
    } catch (error) {
      this.abort();
      throw error;
    }

    if (isPromise(result)) {
      return result.then(
        (resolved) =>
          this.buildExecutionGroupResult(deliveryGroups, path, resolved),
        (error: unknown) => {
          this.abort();
          throw error;
        },
      );
    }

    return this.buildExecutionGroupResult(deliveryGroups, path, result);
  }

  buildExecutionGroupResult(
    deliveryGroups: ReadonlyArray<DeliveryGroup>,
    path: Path | undefined,
    result: ObjMap<unknown>,
  ): ExecutionGroupResult {
    const data = result;
    const errors = this.collectedErrors.errors;
    return this.finish({
      value: errors.length
        ? { deliveryGroups, path: pathToArray(path), errors, data }
        : { deliveryGroups, path: pathToArray(path), data },
      work: this.getIncrementalWork(),
    });
  }

  getIncrementalWork(): IncrementalWork {
    const { groups, tasks, streams, collectedErrors } = this;

    if (collectedErrors.errors.length === 0) {
      return { groups, tasks, streams };
    }

    const cancellationReason = new Error(
      'Cancelled secondary to null within original result',
    );

    const filteredTasks: Array<ExecutionGroup> = [];
    for (const task of tasks) {
      if (collectedErrors.hasNulledPosition(task.path)) {
        const aborted = task.computation.abort(cancellationReason);
        invariant(!isPromise(aborted));
      } else {
        filteredTasks.push(task);
      }
    }

    const filteredStreams: Array<ItemStream> = [];
    for (const stream of streams) {
      if (collectedErrors.hasNulledPosition(stream.path)) {
        const aborted = stream.queue.abort(cancellationReason);
        invariant(!isPromise(aborted));
      } else {
        filteredStreams.push(stream);
      }
    }

    return {
      groups,
      tasks: filteredTasks,
      streams: filteredStreams,
    };
  }

  /**
   * Instantiates new DeliveryGroups for the given path, returning an
   * updated map of DeferUsage objects to DeliveryGroups.
   *
   * Note: As defer directives may be used with operations returning lists,
   * a DeferUsage object may correspond to many DeliveryGroups.
   *
   * @internal
   */
  getNewDeliveryGroupMap(
    newDeferUsages: ReadonlyArray<DeferUsage>,
    deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup> | undefined,
    path: Path | undefined,
  ): {
    newDeliveryGroups: ReadonlyArray<DeliveryGroup>;
    newDeliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup>;
  } {
    const newDeliveryGroups: Array<DeliveryGroup> = [];
    const newDeliveryGroupMap = new Map(deliveryGroupMap);

    // For each new deferUsage object:
    for (const newDeferUsage of newDeferUsages) {
      const parentDeferUsage = newDeferUsage.parentDeferUsage;

      const parent =
        parentDeferUsage === undefined
          ? undefined
          : deliveryGroupFromDeferUsage(parentDeferUsage, newDeliveryGroupMap);

      // Create a new DeliveryGroup object
      const deliveryGroup: DeliveryGroup = {
        path,
        label: newDeferUsage.label,
        parent,
      };

      // Add it to the list of new groups
      newDeliveryGroups.push(deliveryGroup);

      // Update the map
      newDeliveryGroupMap.set(newDeferUsage, deliveryGroup);
    }

    return {
      newDeliveryGroups,
      newDeliveryGroupMap,
    };
  }

  shouldDefer(
    parentDeferUsages: undefined | DeferUsageSet,
    deferUsages: DeferUsageSet,
  ): boolean {
    // If we have a new child defer usage, defer.
    // Otherwise, this defer usage was already deferred when it was initially
    // encountered, and is now in the midst of executing early, so the new
    // deferred grouped fields set can be executed immediately.
    return (
      parentDeferUsages === undefined ||
      !Array.from(deferUsages).every((deferUsage) =>
        parentDeferUsages.has(deferUsage),
      )
    );
  }

  override handleStream(
    index: number,
    path: Path,
    iterator:
      | { handle: Iterator<unknown>; isAsync?: never }
      | { handle: AsyncIterator<unknown>; isAsync: true },
    streamUsage: StreamUsage,
    info: GraphQLResolveInfo,
    itemType: GraphQLOutputType,
  ): boolean {
    const { handle, isAsync } = iterator;
    const queue = this.buildStreamItemQueue(
      index,
      path,
      handle,
      streamUsage.fieldDetailsList,
      info,
      itemType,
      isAsync,
    );

    const itemStream: ItemStream = {
      label: streamUsage.label,
      path,
      queue,
      initialCount: index,
    };

    this.streams.push(itemStream);
    return true;
  }

  buildStreamItemQueue(
    initialIndex: number,
    streamPath: Path,
    iterator: Iterator<unknown> | AsyncIterator<unknown>,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    itemType: GraphQLOutputType,
    isAsync: boolean | undefined,
  ): Queue<StreamItemResult> {
    const createSubExecutor = this.getCreateSubExecutor();
    const { enableEarlyExecution } = this.validatedExecutionArgs;
    const sharedExecutionContext = this.sharedExecutionContext;
    const queue = new Queue<StreamItemResult>(
      async ({ push, stop, onStop, started }) => {
        const abortStreamItems = new Set<(reason?: unknown) => void>();
        let finishedNormally = false;
        let stopRequested = false;

        onStop((reason) => {
          stopRequested = true;
          if (!finishedNormally) {
            for (const abortStreamItem of abortStreamItems) {
              abortStreamItem(reason);
            }
            if (isAsync) {
              sharedExecutionContext.asyncWorkTracker.add(
                returnIteratorCatchingErrors(
                  iterator as AsyncIterator<unknown>,
                ),
              );
            } else {
              sharedExecutionContext.asyncWorkTracker.addValues(
                collectIteratorPromises(iterator as Iterator<unknown>),
              );
            }
          }
        });
        await (enableEarlyExecution ? Promise.resolve() : started);
        if (stopRequested) {
          return;
        }
        let index = initialIndex;
        while (true) {
          let iteration;
          try {
            if (isAsync) {
              // eslint-disable-next-line no-await-in-loop
              iteration = await iterator.next();
              if (stopRequested) {
                return;
              }
            } else {
              iteration = (iterator as Iterator<unknown>).next();
            }
          } catch (rawError) {
            throw locatedError(
              rawError,
              toNodes(fieldDetailsList),
              pathToArray(streamPath),
            );
          }

          if (iteration.done) {
            finishedNormally = true;
            const stopped = stop();
            /* node:coverage disable */
            if (isPromise(stopped)) {
              stopped.catch(() => undefined);
            }
            /* node:coverage enable */
            return;
          }

          const itemPath = addPath(streamPath, index, undefined);

          const executor = createSubExecutor();

          let streamItemResult = executor.completeStreamItem(
            itemPath,
            iteration.value,
            fieldDetailsList,
            info,
            itemType,
          );
          if (isPromise(streamItemResult)) {
            if (enableEarlyExecution) {
              const abortStreamItem = (reason?: unknown) =>
                executor.abort(reason);
              abortStreamItems.add(abortStreamItem);
              streamItemResult = streamItemResult.finally(() => {
                abortStreamItems.delete(abortStreamItem);
              });
            } else {
              // eslint-disable-next-line no-await-in-loop
              streamItemResult = await streamItemResult;
              if (stopRequested) {
                return;
              }
            }
          }
          const pushResult = push(streamItemResult);
          if (isPromise(pushResult)) {
            // eslint-disable-next-line no-await-in-loop
            await pushResult;
            if (stopRequested) {
              return;
            }
          }
          index += 1;
        }
      },
      // set initialCapacity to 100 by default
      100,
    );
    return queue;
  }

  completeStreamItem(
    itemPath: Path,
    item: unknown,
    fieldDetailsList: FieldDetailsList,
    info: GraphQLResolveInfo,
    itemType: GraphQLOutputType,
  ): PromiseOrValue<StreamItemResult> {
    if (isPromiseLike(item)) {
      return this.completePromisedValue(
        itemType,
        fieldDetailsList,
        info,
        itemPath,
        item,
        undefined,
      )
        .then(
          (resolvedItem) => this.buildStreamItemResult(resolvedItem),
          (rawError: unknown) => {
            this.handleFieldError(
              rawError,
              itemType,
              fieldDetailsList,
              itemPath,
            );
            return this.buildStreamItemResult(null);
          },
        )
        .then(undefined, (error: unknown) => {
          this.abort();
          throw error;
        });
    }

    let result: PromiseOrValue<unknown>;
    try {
      try {
        result = this.completeValue(
          itemType,
          fieldDetailsList,
          info,
          itemPath,
          item,
          undefined,
        );
      } catch (rawError) {
        this.handleFieldError(rawError, itemType, fieldDetailsList, itemPath);
        return this.buildStreamItemResult(null);
      }
    } catch (error) {
      this.abort();
      throw error;
    }

    if (isPromise(result)) {
      return result
        .then(
          (resolved) => this.buildStreamItemResult(resolved),
          (rawError: unknown) => {
            this.handleFieldError(
              rawError,
              itemType,
              fieldDetailsList,
              itemPath,
            );
            return this.buildStreamItemResult(null);
          },
        )
        .then(undefined, (error: unknown) => {
          this.abort();
          throw error;
        });
    }

    return this.buildStreamItemResult(result);
  }

  buildStreamItemResult(result: unknown): StreamItemResult {
    const item = result;
    const errors = this.collectedErrors.errors;
    const work = this.getIncrementalWork();
    return this.finish(
      errors.length > 0
        ? { value: { item, errors }, work }
        : { value: { item }, work },
    );
  }
}

function toNodes(fieldDetailsList: FieldDetailsList): ReadonlyArray<FieldNode> {
  return fieldDetailsList.map((fieldDetails) => fieldDetails.node);
}

function getDeliveryGroups(
  deferUsageSet: DeferUsageSet,
  deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup>,
): ReadonlyArray<DeliveryGroup> {
  return Array.from(deferUsageSet).map((deferUsage) =>
    deliveryGroupFromDeferUsage(deferUsage, deliveryGroupMap),
  );
}

function deliveryGroupFromDeferUsage(
  deferUsage: DeferUsage,
  deliveryGroupMap: ReadonlyMap<DeferUsage, DeliveryGroup>,
): DeliveryGroup {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return deliveryGroupMap.get(deferUsage)!;
}
